import streamlit as st
from datetime import datetime
from db import create_conversation, get_conversation, update_conversation, list_conversations, delete_conversation
from service_docs import docs_page

############################
# Tronquer le titre
############################
def truncate_title(title, max_length=20):
    """Retourne le titre tronqué à max_length caractères avec '...' si besoin."""
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
    now = datetime.utcnow()
    groups = {"Aujourd’hui": [], "7 jours précédents": [], "30 jours précédents": [], "Plus anciennes": []}
    for conv in conversations:
        dt_str = conv["updated_at"].replace("Z", "")
        dt = datetime.fromisoformat(dt_str)
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
    # Réinitialise la conversation sélectionnée pour forcer la création lors du premier message
    if "selected_docs_conversation" in st.session_state:
        st.session_state.pop("selected_docs_conversation")
    st.rerun()

############################
# Fonction principale
############################
def main():
    st.set_page_config(page_title="Chat - Azure OpenAI", page_icon="💬", layout="wide")

    # CSS pour personnaliser l'apparence
    st.markdown(
        """
        <style>
        [data-testid="stSidebar"] {
            min-width: 300px !important;
            max-width: 300px !important;
        }
        div.stButton > button {
            background: none !important;
            border: none !important;
            padding: 10px 12px !important;
            margin: 0 !important;
            font-size: 18px !important;
            text-align: left !important;
            justify-content: flex-start !important;
            width: 100% !important;
        }
        div.stButton > button:hover {
            background-color: rgba(255,255,255,0.2) !important;
        }
        /* Réduire la largeur du selectbox du modèle */
        [data-baseweb="select"] {
            margin-top: 8px;
            width: 150px !important;
            border-radius: 5px;
        }
        [data-baseweb="select"] .css-1wa3eu0-placeholder {
            font-size: 20px;
        }
        </style>
        """,
        unsafe_allow_html=True
    )

    user_id = "user-123"
    
    # Le bouton "💬 Chat" réinitialise l'ID de conversation pour "ouvrir" une nouvelle conversation,
    # la conversation sera créée lors de l'envoi du premier message dans docs_page.
    if st.sidebar.button("💬🤖 Chat Azure OpenAI 🤖💬", key="new_chat"):
        new_chat()

    display_model_selector()
    display_global_history_docs(user_id)

    selected_model = st.session_state.get("selected_model", "GPT 4o-mini")
    docs_page(user_id, selected_model)

if __name__ == "__main__":
    main()
