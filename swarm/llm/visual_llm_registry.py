import os
from typing import Optional
from class_registry import ClassRegistry

from swarm.llm.visual_llm import VisualLLM


class VisualLLMRegistry:
    registry = ClassRegistry()

    @classmethod
    def register(cls, *args, **kwargs):
        return cls.registry.register(*args, **kwargs)
    
    @classmethod
    def keys(cls):
        return cls.registry.keys()

    @classmethod
    def get(cls, model_name: Optional[str] = None) -> VisualLLM:
        if model_name is None:
            model_name = "gpt-4-vision-preview"

        if model_name == 'mock':
            model = cls.registry.get(model_name)
        elif model_name.startswith("gpt") and not os.getenv("OPENAI_API_KEY"):
            model = cls.registry.get('mock')
        else: # any version of GPT4VChat like "gpt-4-vision-preview"
            model = cls.registry.get('GPT4VChat', model_name)

        return model
