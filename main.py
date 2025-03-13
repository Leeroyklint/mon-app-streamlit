import streamlit as st
import json
import base64
import jwt  # Assurez-vous d'avoir PyJWT installé
import os
from datetime import datetime, timezone

# Import de vos fonctions pour la gestion de la base de données et la logique du chatbot
from db import create_conversation, get_conversation, update_conversation, list_conversations, delete_conversation
from service_docs import docs_page

############################
# Fonctions utilitaires
############################
def truncate_title(title, max_length=20):
    """Retourne le titre tronqué à max_length caractères avec '...' si besoin."""
    return title if len(title) <= max_length else title[:max_length] + "..."

def display_model_selector():
    selected_model = st.selectbox(
        "Sélectionner un modèle", 
        ["GPT 4o-mini", "GPT 4o", "GPT o1-mini - Maintenance"],
        label_visibility="collapsed"
    )
    st.session_state["selected_model"] = selected_model

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

def new_chat():
    if "selected_docs_conversation" in st.session_state:
        st.session_state.pop("selected_docs_conversation")
    st.rerun()

############################
# Récupération et décodage du token Azure Easy Auth
############################
def get_user_details():
    """
    Récupère le token d'accès Azure (X-Ms-Token-Aad-Access-Token) depuis les headers,
    le décode et retourne un dictionnaire contenant les claims.
    """
    # st.context.headers est disponible si l'app est déployée avec Easy Auth
    headers = st.context.headers
    token = headers.get("X-Ms-Token-Aad-Access-Token")
    if not token:
        return None
    try:
        # Décodage du token sans vérifier la signature (pour extraire les claims)
        decoded = jwt.decode(token, algorithms=["RS256"], options={"verify_signature": False})
        return decoded
    except Exception as e:
        st.error(f"Erreur lors du décodage du token : {e}")
        return None

def get_current_user_info():
    """
    Utilise le token décodé pour extraire l'oid et le nom de l'utilisateur.
    """
    decoded = get_user_details()
    if not decoded:
        return None
    oid = decoded.get("oid")
    # On peut utiliser "name", "preferred_username" ou "upn" selon la configuration de votre Azure AD
    name = decoded.get("name") or decoded.get("preferred_username") or decoded.get("upn")
    return {"oid": oid, "name": name}

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

    # Récupération des informations utilisateur via Easy Auth
    user_info = get_current_user_info()
    if not user_info or not user_info.get("oid"):
        st.error("Vous n'êtes pas authentifié ou aucune information d'utilisateur n'a été trouvée.")
        st.stop()

    st.session_state["entra_oid"] = user_info["oid"]
    st.sidebar.markdown(f"### Connecté en tant que **{user_info.get('name', 'Utilisateur inconnu')}**")

    if st.sidebar.button("💬🤖 Chat Azure OpenAI 🤖💬", key="new_chat"):
        new_chat()

    display_model_selector()
    display_global_history_docs(st.session_state["entra_oid"])

    selected_model = st.session_state.get("selected_model", "GPT 4o-mini")
    docs_page(st.session_state["entra_oid"], selected_model)

if __name__ == "__main__":
    main()
