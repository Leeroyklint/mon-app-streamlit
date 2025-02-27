import streamlit as st
from service_cv import page_formatage_cv
from service_chat import page_chat

def main():
    st.sidebar.title("Menu de navigation")
    choix = st.sidebar.radio("Choisissez un service :", ("Formatage de CV", "Chat Conversationnel"))

    if choix == "Formatage de CV":
        page_formatage_cv()
    elif choix == "Chat Conversationnel":
        page_chat()

if __name__ == "__main__":
    main()
