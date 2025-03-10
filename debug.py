import os
import streamlit as st

def debug_environment():
    st.write("### Variables d'environnement en production")
    # Affiche toutes les variables d'environnement
    for key, value in os.environ.items():
        st.write(f"{key} = {value}")

def main():
    st.title("Debug Environment Variables")
    debug_environment()

if __name__ == "__main__":
    main()
