import React, { useState, useEffect } from 'react';
import "./AIModelSelector.css";
import { selectModel } from '../services/modelService';
const AIModelSelector = ({ models }) => {
    const defaultModelId = models.find(model => model.id === "model1")?.id || '';
    const [selectedModel, setSelectedModel] = useState(defaultModelId);
    useEffect(() => {
        if (defaultModelId) {
            selectModel(defaultModelId).catch(error => console.error(error));
        }
    }, [defaultModelId]);
    const handleSelectChange = async (event) => {
        const modelId = event.target.value;
        setSelectedModel(modelId);
        try {
            await selectModel(modelId);
        }
        catch (error) {
            console.error("Erreur :", error);
        }
    };
    return (React.createElement("select", { value: selectedModel, onChange: handleSelectChange },
        React.createElement("option", { value: "", disabled: true }, "S\u00E9lectionnez un mod\u00E8le"),
        models.map((model) => (React.createElement("option", { key: model.id, value: model.id }, model.name)))));
};
export default AIModelSelector;
