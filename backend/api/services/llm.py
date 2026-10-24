import logging
import json
from typing import List, Dict, Optional, AsyncGenerator
import openai
from google import genai
from google.genai import types
from config import settings
from services.models import validate_model_rules, get_default_model_for_provider

logger = logging.getLogger("llm_service")

def get_active_providers(preferred_provider: Optional[str] = None) -> List[str]:
    raw_order = [p.strip().lower() for p in settings.llm_provider_order.split(",") if p.strip()]
    
    if preferred_provider:
        pref = preferred_provider.strip().lower()
        if pref in raw_order:
            raw_order.remove(pref)
        raw_order.insert(0, pref)

    providers = []
    provider_keys = {
        "gemini": settings.gemini_api_key,
        "groq": settings.groq_api_key,
    }

    for p in raw_order:
        if p in provider_keys and provider_keys[p]:
            providers.append(p)
    return providers

def get_openai_client(provider: str, custom_model: Optional[str] = None) -> tuple[openai.AsyncOpenAI, str]:
    if provider == "groq":
        model = custom_model or get_default_model_for_provider("groq") or settings.groq_llm_model
        return openai.AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url="https://api.groq.com/openai/v1"
        ), model
    elif provider == "mistral":
        raise ValueError("Mistral provider is currently disabled.")
    else:
        raise ValueError(f"Unknown OpenAI-compatible provider: {provider}")

def prepare_openai_messages(history: List[Dict[str, str]], query: str, system_instruction: str) -> List[Dict[str, str]]:
    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    
    for msg in history:
        role = "assistant" if msg.get("role") in ["model", "assistant"] else "user"
        messages.append({"role": role, "content": msg["content"]})
        
    if query:
        messages.append({"role": "user", "content": query})
        
    return messages

async def generate_text_with_fallback(
    prompt: str,
    system_instruction: Optional[str] = None,
    preferred_provider: Optional[str] = None,
    preferred_model: Optional[str] = None
) -> str:
    if preferred_model and preferred_model != "auto":
        is_valid, validation_err = validate_model_rules(preferred_model, preferred_provider)
        if not is_valid:
            raise ValueError(f"Invalid model '{preferred_model}': {validation_err}")

    active_providers = get_active_providers(preferred_provider)
    if not active_providers:
        raise RuntimeError("No LLM providers have active API keys configured.")

    errors = []
    for provider in active_providers:
        try:
            if provider == "gemini":
                dynamic_gemini = get_default_model_for_provider("gemini") or settings.gemini_llm_model
                model_to_use = preferred_model if (preferred_provider == "gemini" and preferred_model) else dynamic_gemini
                logger.info(f"[LLM Processing] Processing text request with provider '{provider}' (model: '{model_to_use}')...")
                
                client = genai.Client(api_key=settings.gemini_api_key)
                full_prompt = f"{system_instruction}\n\n{prompt}" if system_instruction else prompt
                response = await client.aio.models.generate_content(
                    model=model_to_use,
                    contents=full_prompt
                )
                logger.info(f"[LLM Success] Request successfully completed by provider '{provider}' (model: '{model_to_use}').")
                return response.text.strip() if response.text else ""
            else:
                custom_m = preferred_model if (preferred_provider == provider and preferred_model) else None
                oai_client, model = get_openai_client(provider, custom_m)
                logger.info(f"[LLM Processing] Processing text request with provider '{provider}' (model: '{model}')...")
                
                messages = prepare_openai_messages([], prompt, system_instruction or "")
                response = await oai_client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=0.3
                )
                content = response.choices[0].message.content
                logger.info(f"[LLM Success] Request successfully completed by provider '{provider}' (model: '{model}').")
                return content.strip() if content else ""
        except Exception as e:
            model_info = preferred_model if preferred_model else ("gemini" if provider == "gemini" else getattr(settings, f"{provider}_llm_model", ""))
            logger.warning(f"[LLM Fallback Alert] Provider '{provider}' (model: '{model_info}') failed with error: {e}. Falling back to next available provider...")
            errors.append(f"{provider}: {e}")

    raise RuntimeError(f"All active LLM providers failed. Errors: {'; '.join(errors)}")

async def generate_stream_with_fallback(
    history: List[Dict[str, str]],
    query: str,
    system_instruction: str,
    preferred_provider: Optional[str] = None,
    preferred_model: Optional[str] = None
) -> AsyncGenerator[str, None]:
    if preferred_model and preferred_model != "auto":
        is_valid, validation_err = validate_model_rules(preferred_model, preferred_provider)
        if not is_valid:
            error_msg = f"[Error: Invalid model '{preferred_model}'. {validation_err}]"
            logger.error(f"[LLM Error] {error_msg}")
            yield error_msg
            return

    active_providers = get_active_providers(preferred_provider)
    if not active_providers:
        logger.error("[LLM Error] No LLM provider API keys are configured.")
        yield "Error: No LLM provider API keys configured."
        return

    errors = []
    for provider in active_providers:
        try:
            has_yielded = False
            switch_emitted = False
            if provider == "gemini":
                dynamic_gemini = get_default_model_for_provider("gemini") or settings.gemini_llm_model
                model_to_use = preferred_model if (preferred_provider == "gemini" and preferred_model) else dynamic_gemini
                logger.info(f"[LLM Processing] Processing streaming request with provider '{provider}' (model: '{model_to_use}')...")

                is_switched = len(errors) > 0 or (
                    preferred_model and preferred_model != "auto" and model_to_use != preferred_model
                ) or (
                    preferred_provider and preferred_provider != "auto" and provider != preferred_provider
                )
                switch_payload = {
                    "event": "model_switched",
                    "original_provider": preferred_provider,
                    "original_model": preferred_model,
                    "provider": provider,
                    "model": model_to_use,
                }

                client = genai.Client(api_key=settings.gemini_api_key)
                contents = []
                for msg in history:
                    role = "model" if msg.get("role") in ["model", "assistant"] else "user"
                    contents.append(
                        types.Content(
                            role=role,
                            parts=[types.Part.from_text(text=msg["content"])]
                        )
                    )
                contents.append(
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=query)]
                    )
                )
                config = types.GenerateContentConfig(system_instruction=system_instruction)
                response = await client.aio.models.generate_content_stream(
                    model=model_to_use,
                    contents=contents,
                    config=config
                )
                async for chunk in response:
                    if chunk.text:
                        if not switch_emitted and is_switched:
                            yield f"<!-- MODEL_SWITCH:{json.dumps(switch_payload)} -->\n"
                            switch_emitted = True
                        has_yielded = True
                        yield chunk.text
                if has_yielded:
                    logger.info(f"[LLM Success] Streaming request successfully completed by provider '{provider}' (model: '{model_to_use}').")
                    return

            else:
                custom_m = preferred_model if (preferred_provider == provider and preferred_model) else None
                oai_client, model = get_openai_client(provider, custom_m)
                logger.info(f"[LLM Processing] Processing streaming request with provider '{provider}' (model: '{model}')...")

                is_switched = len(errors) > 0 or (
                    preferred_model and preferred_model != "auto" and model != preferred_model
                ) or (
                    preferred_provider and preferred_provider != "auto" and provider != preferred_provider
                )
                switch_payload = {
                    "event": "model_switched",
                    "original_provider": preferred_provider,
                    "original_model": preferred_model,
                    "provider": provider,
                    "model": model,
                }

                messages = prepare_openai_messages(history, query, system_instruction)
                stream = await oai_client.chat.completions.create(
                    model=model,
                    messages=messages,
                    stream=True,
                    temperature=0.3
                )
                async for chunk in stream:
                    if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                        text = chunk.choices[0].delta.content
                        if not switch_emitted and is_switched:
                            yield f"<!-- MODEL_SWITCH:{json.dumps(switch_payload)} -->\n"
                            switch_emitted = True
                        has_yielded = True
                        yield text
                if has_yielded:
                    logger.info(f"[LLM Success] Streaming request successfully completed by provider '{provider}' (model: '{model}').")
                    return

        except Exception as e:
            model_info = preferred_model if preferred_model else ("gemini" if provider == "gemini" else getattr(settings, f"{provider}_llm_model", ""))
            logger.warning(f"[LLM Fallback Alert] Provider '{provider}' (model: '{model_info}') failed with error: {e}. Falling back to next available provider...")
            errors.append(f"{provider}: {e}")
            if has_yielded:
                # If we already yielded text to the client before crashing, don't restart generation on another provider
                yield f"\n[Stream interrupted from provider {provider}: {e}]"
                return

    logger.error(f"[LLM Error] All active LLM providers failed. Errors: {'; '.join(errors)}")
    yield f"\n[Error: All LLM providers failed. Details: {'; '.join(errors)}]"
