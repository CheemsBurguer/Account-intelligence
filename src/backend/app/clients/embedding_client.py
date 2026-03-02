from typing import List
from langchain_openai import AzureOpenAIEmbeddings
from ..core.config import settings


class EmbeddingClient:
    """
    Encapsulates embedding generation logic.
    Uses embedding model via LangChain wrapper.
    """

    def __init__(self):
        self.model_name = settings.GEMINI_EMBEDDING_MODEL

        self._embeddings = AzureOpenAIEmbeddings(
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            api_key=settings.AZURE_OPENAI_API_KEY,
            api_version=settings.AZURE_OPENAI_API_VERSION,
            deployment=settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
        )

    def embed_text(self, text: str) -> List[float]:
        """
        Generate embedding vector for a single text.
        """
        return self._embeddings.embed_query(text)

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts.
        """
        return self._embeddings.embed_documents(texts)