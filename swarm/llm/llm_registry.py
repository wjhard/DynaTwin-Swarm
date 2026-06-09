import os
from typing import Optional
from class_registry import ClassRegistry

from swarm.llm.llm import LLM


class LLMRegistry:
    registry = ClassRegistry()

    @classmethod
    def register(cls, *args, **kwargs):
        return cls.registry.register(*args, **kwargs)
    
    @classmethod
    def keys(cls):
        return cls.registry.keys()

    @classmethod
    def get(cls, model_name: Optional[str] = None) -> LLM:
        if model_name is None:
            model_name = "gpt-4-1106-preview"

        if model_name == 'mock':
            model = cls.registry.get(model_name)
        elif model_name.startswith("gpt") and not os.getenv("OPENAI_API_KEY"):
            model = cls.registry.get('mock')
        else: # any version of GPTChat like "gpt-4-1106-preview"
            model = cls.registry.get('GPTChat', model_name)

        return model
