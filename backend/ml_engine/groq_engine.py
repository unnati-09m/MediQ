import os
import json
import logging
from groq import AsyncGroq

# Get logger
logger = logging.getLogger(__name__)

# Initialize Groq client
# The client will automatically pick up GROQ_API_KEY from the environment
try:
    groq_client = AsyncGroq()
except Exception as e:
    logger.error(f"Failed to initialize AsyncGroq client: {e}")
    groq_client = None


async def analyze_urgency(reason: str) -> int:
    """
    Analyzes the patient's self-reported "Reason for Visit" using Groq.
    Returns an integer rating from 1 to 10 evaluating the medical urgency.
    1 = Mild/Routine, 5 = Moderate, 10 = Severe/Emergency
    """
    if not groq_client:
        logger.warning("Groq client not initialized, defaulting urgency to 5.")
        return 5

    prompt = f"""You are an expert medical triage assistant.
Evaluate the patient's reason for visit and determine true medical urgency on a scale of 1 to 10.

STRICT SCORING GUIDELINES:
1-2: Non-urgent / Routine (e.g., regular checkup, mild cold, runny nose, slight headache, prescription refill).
3-4: Minor urgency (e.g., mild fever, sore throat, mild sprain, minor rash).
5-6: Moderate (e.g., high fever that won't go down, deep cuts needing stitches, suspected isolated fractures).
7-8: Urgent (e.g., severe abdominal pain, sudden extreme weakness, minor car accidents).
9-10: Absolute Emergency / Life-Threatening (e.g., HEART ATTACK, severe chest pain, stroke symptoms, uncontrolled heavy bleeding, severe breathing difficulty, unconsciousness).

Patient Reason: "{reason}"

You MUST respond ONLY with a raw JSON object with a single key "urgency" containing the integer score.
Example: {{"urgency": 2}}
"""

    try:
        chat_completion = await groq_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You output only valid JSON."
                },
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model="llama-3.1-8b-instant",
            temperature=0.1,
            max_tokens=20,
            response_format={"type": "json_object"},
        )
        
        response_content = chat_completion.choices[0].message.content
        result = json.loads(response_content)
        urgency = int(result.get("urgency", 5))
        
        # Clamp between 1 and 10
        urgency = max(1, min(10, urgency))
        return urgency

    except Exception as e:
        logger.error(f"Error calling Groq API: {e}")
        return 5

