import streamlit as st
from service_chat import page_chat

def main():
    st.sidebar.title("Menu de navigation")
    choix = st.sidebar.radio("Choisissez un service :", ("Formatage de CV", "Chat Conversationnel"))

    if choix == "Chat Conversationnel":
        page_chat()
    

if __name__ == "__main__":
    main()
