  import React, { useEffect, useState } from "react";
  import { useNavigate, useLocation } from "react-router-dom";
  import { Conversation } from "../interfaces/interfaces";
  import {
    getConversations,
    deleteConversation,
  } from "../services/conversationService";
  import ConfirmModal from "./ConfirmModal";
  import "./Conversations.css";

  const Conversations: React.FC = () => {
    const [groups, setGroups] = useState<Record<string, Conversation[]>>({});
    const [error, setError]   = useState("");
    const [toDelete, setToDelete] = useState<string | null>(null); // id à confirmer
    const navigate = useNavigate();
    const location = useLocation();

    const currentConvId = location.pathname.startsWith("/conversation/")
      ? location.pathname.split("/")[2]
      : null;

    /* ------------------- chargement liste ---------------------------- */
    const fetchConvs = async () => {
      try {
        const data = await getConversations();
        const clean: Record<string, Conversation[]> = {};
        Object.entries(data).forEach(([g, lst]) => {
          const l = lst.filter((c) => !c.project_id);
          if (l.length) clean[g] = l;
        });
        setGroups(clean);
      } catch {
        setError("Erreur chargement conversations");
      }
    };

    useEffect(() => {
      fetchConvs();
      const id = setInterval(fetchConvs, 3_000);
      /* + rafraîchissement instantané quand ChatApp crée un nouveau chat */
      const onNew = () => fetchConvs();
      window.addEventListener("conversationCreated", onNew);
      return () => {
        clearInterval(id);
        window.removeEventListener("conversationCreated", onNew);
      };
    }, []);

    /* ------------------- suppression + redirection ------------------- */
    const confirmDelete = (id: string) => setToDelete(id);

    const reallyDelete = async () => {
      if (!toDelete) return;
      try {
        await deleteConversation(toDelete);
        await fetchConvs();
        if (toDelete === currentConvId) {
          navigate("/");
          window.location.reload();
        }
      } catch {
        alert("Erreur suppression conversation");
      }
      setToDelete(null);
    };

    /* ------------------- rendu --------------------------------------- */
    if (error) return <div>{error}</div>;
    if (Object.keys(groups).length === 0) return null;

    const trunc = (t = "") => (t.length <= 15 ? t : t.slice(0, 15) + "…");

    return (
      <>
        {Object.entries(groups).map(([grp, convs]) => (
          <div key={grp}>
            <h4>{grp}</h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {convs.map((c) => (
                <li
                  key={c.id}
                  className={`sidebar-list-item ${
                    c.id === currentConvId ? "active" : ""
                  }`}
                  onClick={() => navigate(`/conversation/${c.id}`)}
                >
                  <span>{trunc(c.title)}</span>
                  <button
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDelete(c.id);
                    }}
                  >
                    –
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* ----- modal confirmation ----- */}
        <ConfirmModal
          open={!!toDelete}
          title="Supprimer le chat ?"
          message="Cette action est définitive."
          onCancel={() => setToDelete(null)}
          onConfirm={reallyDelete}
        />
      </>
    );
  };

  export default Conversations;
