/**
 * InterviewQuestions component - Manages the interview flow and questions
 */
import { useEffect } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import "./interview-questions.scss";

export default function InterviewQuestions() {
  const { setConfig } = useLiveAPIContext();

  // Set up the interview system instructions when component mounts
  useEffect(() => {
    setConfig({
      model: "models/gemini-2.0-flash-exp",
      generationConfig: {
        responseModalities: "audio", // This should include text by default
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
        },
        temperature: 0.7,
        topP: 0.95,
        topK: 64,
      },
      systemInstruction: {
        parts: [
          {
            text: `You are an AI interview coach conducting a mock interview. Your role is to:
after greating user hello start the interview please be focused on interview 
            1. Introduce yourself briefly as "Interview Coach" and explain that you'll be conducting a mock interview.
            2. Ask relevant interview questions one at a time, waiting for the user to respond.
            3. Start with common questions like "Tell me about yourself" and progress to more specific questions.
            4. Listen to the user's responses and provide brief, constructive feedback.
            5. Ask follow-up questions when appropriate.
            6. After 5-7 questions, conclude the interview with positive feedback and suggestions for improvement.



            strictly donot ask about stenghts and weaknesses instead ask about the projects and skills the user has
            Keep your responses concise and professional. Maintain a supportive but realistic interview atmosphere.
            Don't ask for additional information before starting - just begin the interview process naturally.`,
          },
        ],
      },
      tools: [
        // there is a free-tier quota for search
        { googleSearch: {} },
      ],
    });
  }, [setConfig]);

  return (
    <div className="interview-questions-container">
      {/* This component doesn't render anything visible, it just sets up the interview context */}
    </div>
  );
}
