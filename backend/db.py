import os
from azure.cosmos import CosmosClient
from datetime import datetime
import uuid
from dotenv import load_dotenv
load_dotenv()

COSMOS_ENDPOINT = os.getenv("COSMOS_ENDPOINT")
COSMOS_KEY = os.getenv("COSMOS_KEY")
DATABASE_NAME = os.getenv("AZE_COSMOSDB_DATABASE")
CONTAINER_NAME = os.getenv("AZE_COSMOSDB_CONVERSATION_CONTAINER")

client = CosmosClient(COSMOS_ENDPOINT, credential=COSMOS_KEY)
database = client.get_database_client(DATABASE_NAME)
container = database.get_container_client(CONTAINER_NAME)

def create_conversation(entra_oid: str, initial_message: str = None, conversation_type="chat", project_id=None) -> dict:
    conversation_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    if initial_message:
        title = initial_message[:30]
        messages = [{"role": "user", "content": initial_message}]
    else:
        title = f"Nouveau Chat {now[:19]}"
        messages = [{"role": "assistant", "content": "Bonjour, comment puis-je vous aider ?"}]
    doc = {
        "id": conversation_id,
        "entra_oid": entra_oid,
        "session_id": conversation_id,
        "title": title,
        "created_at": now,
        "updated_at": now,
        "messages": messages,
        "type": conversation_type
    }
    if project_id:
        doc["project_id"] = project_id
    container.create_item(doc)
    return doc

def delete_conversation(entra_oid: str, conversation_id: str) -> None:
    container.delete_item(conversation_id, partition_key=entra_oid)

def get_conversation(entra_oid: str, conversation_id: str) -> dict:
    try:
        item = container.read_item(conversation_id, partition_key=entra_oid)
        return item
    except Exception as e:
        print(f"[get_conversation] Erreur : {e}")
        # Ici, on pourrait renvoyer None explicitement
        return None


def update_conversation(conversation_data: dict) -> None:
    conversation_data["updated_at"] = datetime.utcnow().isoformat()
    container.upsert_item(conversation_data)

def list_conversations(entra_oid: str, conversation_type=None, project_id=None) -> list:
    query = (
        "SELECT c.id, c.title, c.created_at, c.updated_at, c.type, c.project_id "
        "FROM c "
        "WHERE c.entra_oid = @entra_oid "
    )
    parameters = [{"name": "@entra_oid", "value": entra_oid}]
    if conversation_type:
        query += "AND c.type = @type "
        parameters.append({"name": "@type", "value": conversation_type})
    if project_id:
        query += "AND c.project_id = @project_id "
        parameters.append({"name": "@project_id", "value": project_id})
    query += "ORDER BY c.updated_at DESC"
    items = container.query_items(query=query, parameters=parameters, enable_cross_partition_query=True)
    return list(items)

def create_project(entra_oid: str, project_name: str, instructions: str) -> dict:
    project_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    doc = {
        "id": project_id,
        "entra_oid": entra_oid,
        "name": project_name,
        "instructions": instructions,
        "created_at": now,
        "updated_at": now,
        "type": "project",
        "files": []
    }
    container.create_item(doc)
    return doc

def get_project(entra_oid: str, project_id: str) -> dict:
    try:
        item = container.read_item(project_id, partition_key=entra_oid)
        if item.get("type") == "project":
            return item
        else:
            return None
    except Exception as e:
        print(f"[get_project] Erreur : {e}")
        return None

def update_project(project_data: dict) -> None:
    project_data["updated_at"] = datetime.utcnow().isoformat()
    container.upsert_item(project_data)

def list_projects(entra_oid: str) -> list:
    query = (
        "SELECT c.id, c.name, c.created_at, c.updated_at "
        "FROM c "
        "WHERE c.entra_oid = @entra_oid AND c.type = 'project' AND IS_DEFINED(c.name) "
        "ORDER BY c.updated_at DESC"
    )
    parameters = [{"name": "@entra_oid", "value": entra_oid}]
    items = container.query_items(query=query, parameters=parameters, enable_cross_partition_query=True)
    return list(items)

def delete_project(entra_oid: str, project_id: str) -> None:
    container.delete_item(project_id, partition_key=entra_oid)
