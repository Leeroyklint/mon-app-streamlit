import React, { useState, useEffect } from 'react';
import "./AIModelSelector.css";
import { selectModel } from '../services/modelService';

interface AIModel {
  id: string;
  name: string;
}

interface AIModelSelectorProps {
  models: AIModel[];
}

const AIModelSelector: React.FC<AIModelSelectorProps> = ({ models }) => {
  const defaultModelId = models.find(model => model.id === "model1")?.id || '';
  const [selectedModel, setSelectedModel] = useState<string>(defaultModelId);

  useEffect(() => {
    if (defaultModelId) {
      selectModel(defaultModelId).catch(error => console.error(error));
    }
  }, [defaultModelId]);

  const handleSelectChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const modelId = event.target.value;
    setSelectedModel(modelId);
    try {
      await selectModel(modelId);
    } catch (error) {
      console.error("Erreur :", error);
    }
  };

  return (
    <select value={selectedModel} onChange={handleSelectChange}>
      <option value="" disabled>Sélectionnez un modèle</option>
      {models.map((model) => (
        <option key={model.id} value={model.id}>{model.name}</option>
      ))}
    </select>
  );
};

export default AIModelSelector;
