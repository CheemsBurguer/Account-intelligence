from typing import Optional, Type
from langchain_openai import AzureChatOpenAI
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import PromptTemplate
from pydantic import BaseModel
from app.core.config import settings
import json
import logging

logger = logging.getLogger(__name__)

class LLMClient:
    """
    Encapsulates LLM interaction.
    Supports both free-form generation and structured output.
    """

    def __init__(self):
        self.model_name = settings.GEMINI_LLM_MODEL

        self._llm = AzureChatOpenAI(
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            api_key=settings.AZURE_OPENAI_API_KEY,
            api_version=settings.AZURE_OPENAI_API_VERSION,
            deployment_name=settings.AZURE_OPENAI_CHAT_DEPLOYMENT,
            temperature=0.3,
        )

    def generate_text(self, prompt: str) -> str:
        """
        Generate free-form text.
        """
        response = self._llm.invoke(prompt)
        return response.content

    def generate_structured_output(
        self,
        prompt: str,
        output_schema: Type[BaseModel],
    ) -> BaseModel:
        """
        Generate structured output validated by Pydantic schema.
        """

        parser = PydanticOutputParser(pydantic_object=output_schema)

        formatted_prompt = PromptTemplate(
            template=prompt + "\n\n{format_instructions}",
            input_variables=[],
            partial_variables={
                "format_instructions": parser.get_format_instructions()
            },
        )

        final_prompt = formatted_prompt.format()

        response = self._llm.invoke(final_prompt)

        return parser.parse(response.content)
    

    def generate_sales_strategy(self, context_payload: dict):

        prompt = f"""
        You are a senior enterprise sales strategist coaching an Account Manager 
        before a high-stakes executive conversation.

        Your role is NOT to write a marketing document.
        Your role is to craft a persuasive executive discussion narrative.

        The Account Manager:
        - Is business-oriented (not deeply technical)
        - Must sound strategic and credible
        - Needs clear business positioning
        - Must connect products to financial outcomes

        The tone must be:
        - Direct
        - Confident
        - Consultative
        - Executive-level
        - Outcome-driven
        - Natural (NOT robotic, NOT generic)

        Avoid:
        - Marketing fluff
        - Buzzwords without impact
        - Long academic explanations
        - Overly technical language

        ==============================
        ACCOUNT CONTEXT
        ==============================
        {json.dumps(context_payload, indent=2)}

        ==============================
        STRICT OUTPUT FORMAT
        ==============================

        Return ONLY valid JSON with EXACTLY these keys:

        {{
          "account_strategic_overview": "...",

          "priority_initiatives": [
            {{
              "initiative": "...",
              "business_problem": "...",
              "recommended_products": ["..."],
              "expected_business_outcome": "...",
              "risk_if_delayed": "..."
            }}
          ],

          "financial_positioning": "...",

          "technical_enablement_summary": "...",

          "objection_handling": [
            {{
              "objection": "...",
              "response": "..."
            }}
          ],

          "executive_conversation_version": "...",

          "email_version": "..."
        }}

        ==============================
        CRITICAL INSTRUCTIONS
        ==============================

        1. The executive_conversation_version must:

           - Open with strategic tension (not "We are here today...")
           - Frame the account's transformation in business terms
           - Connect accepted products explicitly by name
           - Tie infrastructure decisions to margin, cost, or growth impact
           - Include a confident, specific next step
           - Sound like a real executive conversation

        2. The email_version must:

           - Be shorter than the executive version
           - Mention accepted products naturally
           - Contain a clear call-to-action
           - Be ready to send (with placeholders like [Executive Name])

        3. Do NOT invent products.
        4. Use ONLY the accepted products provided.
        5. Return ONLY JSON.
        6. No markdown.
        7. No explanation outside JSON.
        """

        response = self._llm.invoke(prompt)

        response_text = response.text.strip()

        if response_text.startswith("```"):
            response_text = response_text.split("```")[1].strip()

        try:
            return json.loads(response_text)
        except Exception:
            logger.error("LLM returned invalid JSON")
            return {
                "account_strategic_overview": response_text,
                "priority_initiatives": [],
                "financial_positioning": "",
                "technical_enablement_summary": "",
                "objection_handling": [],
                "executive_conversation_version": response_text,
                "email_version": ""
            }
        