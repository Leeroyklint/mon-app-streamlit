import streamlit as st
import requests

import dotenv

dotenv.load_dotenv()

# Configuration Azure OpenAI (clé API et URL du endpoint)
API_KEY = os.getenv("AZ_OPENAI_API")
AZURE_ENDPOINT = os.getenv("AZ_OPENAI_ENDPOINT")

def azure_llm_chat(messages):
    headers = {"Content-Type": "application/json", "api-key": API_KEY}
    data = {"messages": messages, "max_tokens": 2048}
    response = requests.post(AZURE_ENDPOINT, headers=headers, json=data)
    if response.status_code == 200:
        result = response.json()
        return result["choices"][0]["message"]["content"]
    else:
        return f"Erreur {response.status_code}: {response.text}"

def page_chat():
    st.title("💬 Chat avec Azure OpenAI")
    st.write("Commencez une conversation avec Azure OpenAI.")

    # Initialisation de l'historique de conversation
    if "chat_history" not in st.session_state:
        st.session_state["chat_history"] = [{"role": "system", "content": "Tu es un assistant IA utile."}]

    # Affichage de l'historique
    for msg in st.session_state["chat_history"]:
        if msg["role"] == "user":
            st.markdown(f"**Vous :** {msg['content']}")
        elif msg["role"] == "assistant":
            st.markdown(f"**Assistant :** {msg['content']}")

    user_input = st.text_input("Votre message :", key="user_input")
    if st.button("Envoyer"):
        if user_input:
            # Ajouter le message de l'utilisateur à l'historique
            st.session_state.chat_history.append({"role": "user", "content": user_input})
            with st.spinner("Azure OpenAI réfléchit..."):
                response = azure_llm_chat(st.session_state.chat_history)
            st.session_state.chat_history.append({"role": "assistant", "content": response})
            st.rerun()
        else:
            st.warning("Veuillez entrer un message.")
