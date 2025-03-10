# db.py
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

def create_conversation(entra_oid: str, initial_message: str = None, conversation_type="chat") -> dict:
    """
    Crée une nouvelle conversation dans la base de données, 
    avec un type par défaut = 'chat' (ou 'doc' pour la partie docs).
    """
    conversation_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    
    if initial_message:
        title = initial_message[:30]  # Titre basé sur les premiers caractères du message
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
        "type": conversation_type  # <-- on stocke explicitement le type
    }

    container.create_item(doc, entra_oid)
    return doc

def delete_conversation(entra_oid: str, conversation_id: str) -> None:
    container.delete_item(conversation_id, entra_oid)

def get_conversation(entra_oid: str, conversation_id: str) -> dict:
    try:
        item = container.read_item(conversation_id, entra_oid)
        return item
    except Exception as e:
        print(f"[get_conversation] Erreur : {e}")
        return None

def update_conversation(conversation_data: dict) -> None:
    """
    Met à jour la conversation dans la base de données. 
    Assurez-vous que 'conversation_data' contient bien 'type' si nécessaire.
    """
    entra_oid = conversation_data.get("entra_oid")
    conversation_data["updated_at"] = datetime.utcnow().isoformat()
    container.upsert_item(conversation_data, entra_oid)

def list_conversations(entra_oid: str) -> list:
    """
    Récupère la liste des conversations de l'utilisateur,
    en incluant le champ 'type' pour distinguer 'chat' de 'doc'.
    """
    query = (
        "SELECT c.id, c.title, c.created_at, c.updated_at, c.type "
        "FROM c "
        "WHERE c.entra_oid = @entra_oid "
        "ORDER BY c.updated_at DESC"
    )
    parameters = [{"name": "@entra_oid", "value": entra_oid}]
    items = container.query_items(query=query, parameters=parameters, enable_cross_partition_query=True)
    return list(items)
