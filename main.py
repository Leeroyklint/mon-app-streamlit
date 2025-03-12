import streamlit as st
import json, time
from datetime import datetime, timezone

# Import de la librairie pour exécuter du JavaScript et récupérer son retour
from streamlit_javascript import st_javascript

# Import de tes fonctions pour gérer l'historique et les documents
from db import create_conversation, get_conversation, update_conversation, list_conversations, delete_conversation
from service_docs import docs_page

############################
# Tronquer le titre
############################
def truncate_title(title, max_length=20):
    return title if len(title) <= max_length else title[:max_length] + "..."

############################
# Sélecteur de modèle
############################
def display_model_selector():
    selected_model = st.selectbox(
        "Sélectionner un modèle", 
        ["GPT 4o-mini", "GPT 4o", "GPT o1-mini - Maintenance"],
        label_visibility="collapsed"
    )
    st.session_state["selected_model"] = selected_model

############################
# Historique des conversations Docs
############################
def display_global_history_docs(user_id):
    docs_convs = [conv for conv in list_conversations(user_id) if conv.get("type") == "doc"]
    grouped_convs = group_conversations_by_date(docs_convs)
    group_order = ["Aujourd’hui", "7 jours précédents", "30 jours précédents", "Plus anciennes"]
    for group in group_order:
        convs = grouped_convs.get(group, [])
        if convs:
            st.sidebar.markdown(f"#### {group}")
            for conv in convs:
                title_truncated = truncate_title(conv["title"], max_length=20)
                col1, col2 = st.sidebar.columns([0.85, 0.15], gap="small")
                with col1:
                    if st.button(f"{title_truncated}", key=f"conv_{conv['id']}"):
                        st.session_state["selected_docs_conversation"] = conv["id"]
                        st.rerun()
                with col2:
                    if st.button("🗑️", key=f"delete_{conv['id']}"):
                        delete_conversation(user_id, conv["id"])
                        if st.session_state.get("selected_docs_conversation") == conv["id"]:
                            st.session_state.pop("selected_docs_conversation", None)
                        st.rerun()

def group_conversations_by_date(conversations):
    now = datetime.now(timezone.utc)
    groups = {"Aujourd’hui": [], "7 jours précédents": [], "30 jours précédents": [], "Plus anciennes": []}
    for conv in conversations:
        dt_str = conv["updated_at"].replace("Z", "")
        dt = datetime.fromisoformat(dt_str).replace(tzinfo=timezone.utc)
        delta = now - dt
        if delta.days == 0:
            groups["Aujourd’hui"].append(conv)
        elif delta.days < 7:
            groups["7 jours précédents"].append(conv)
        elif delta.days < 30:
            groups["30 jours précédents"].append(conv)
        else:
            groups["Plus anciennes"].append(conv)
    return groups

############################
# Bouton nouvelle conversation
############################
def new_chat():
    if "selected_docs_conversation" in st.session_state:
        st.session_state.pop("selected_docs_conversation")
    st.rerun()

############################
# Récupération de l'authentification via JS
############################
def get_user_data():
    """
    Exécute un script JavaScript pour appeler '/.auth/me'
    et récupérer le user_id.
    """
    js_code = """
    await (async () => {
        try {
            const response = await fetch('/.auth/me');
            if (response.ok) {
                const authDetails = await response.json();
                if (authDetails && authDetails[0] && authDetails[0].user_id) {
                    return { "user_id": authDetails[0].user_id, "data": authDetails };
                } else {
                    return { "error": "No user_id found", "data": authDetails };
                }
            } else {
                return { "error": "Failed to fetch /.auth/me", "data": null };
            }
        } catch (error) {
            return { "error": error.message, "data": null };
        }
    })();
    """
    # La fonction st_javascript exécute le code JS et renvoie la valeur retournée (attendue en JSON).
    return st_javascript(js_code)

############################
# Fonction principale
############################
def main():
    st.set_page_config(page_title="Chat - Azure OpenAI", page_icon="💬", layout="wide")
    st.markdown(
        """
        <style>
        [data-testid="stSidebar"] { min-width: 300px !important; max-width: 300px !important; }
        div.stButton > button { background: none !important; border: none !important; padding: 10px 12px !important; margin: 0 !important; font-size: 18px !important; text-align: left !important; justify-content: flex-start !important; width: 100% !important; }
        div.stButton > button:hover { background-color: rgba(255,255,255,0.2) !important; }
        [data-baseweb="select"] { margin-top: 8px; width: 150px !important; border-radius: 5px; }
        [data-baseweb="select"] .css-1wa3eu0-placeholder { font-size: 20px; }
        </style>
        """,
        unsafe_allow_html=True
    )

    # Récupérer les infos utilisateur via JS
    user_data = get_user_data()
    if not user_data:
        st.error("En attente d'authentification via Azure AD (/.auth/me)...")
        st.stop()
    if user_data.get("error"):
        st.error(f"Erreur d'authentification: {user_data.get('error')}")
        st.stop()
    user_id = user_data.get("user_id")
    if not user_id:
        st.error("Aucun user_id n'a été récupéré.")
        st.stop()

    st.session_state["entra_oid"] = user_id
    st.sidebar.markdown(f"### Connecté en tant que **{user_id}**")

    if st.sidebar.button("💬🤖 Chat Azure OpenAI 🤖💬", key="new_chat"):
        new_chat()

    display_model_selector()
    display_global_history_docs(st.session_state["entra_oid"])

    selected_model = st.session_state.get("selected_model", "GPT 4o-mini")
    docs_page(st.session_state["entra_oid"], selected_model)

if __name__ == "__main__":
    main()
