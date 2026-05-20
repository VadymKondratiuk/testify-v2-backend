import { Injectable, Logger } from '@nestjs/common';
import { Difficulty } from '@prisma/client';

type StudyCoachInput = {
  testTitle: string;
  scorePercentage: number;
  isPassed: boolean;
  categoryName?: string | null;
  difficulty: Difficulty;
  focusAreas: string[];
  strongAreas: string[];
};

type ResponsesApiResult = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

const openAiResponsesUrl = 'https://api.openai.com/v1/responses';

@Injectable()
export class AiStudyCoachService {
  private readonly logger = new Logger(AiStudyCoachService.name);

  async generateStudyRecommendation(
    input: StudyCoachInput,
    fallback: string,
  ) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return fallback;
    }

    try {
      const response = await fetch(openAiResponsesUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL ?? 'gpt-5.4-mini',
          input: [
            {
              role: 'system',
              content: [
                {
                  type: 'input_text',
                  text:
                    'You are an encouraging study coach for an online testing platform. ' +
                    'Generate one concise recommendation for the student. ' +
                    'Use only the provided facts. Do not invent scores, tests, or topics. ' +
                    'Write in English, 2-4 sentences, practical and specific.',
                },
              ],
            },
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: JSON.stringify(input),
                },
              ],
            },
          ],
          max_output_tokens: 180,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        this.logger.warn(`OpenAI request failed: ${response.status} ${message}`);
        return fallback;
      }

      const data = (await response.json()) as ResponsesApiResult;
      const text = this.extractText(data);

      return text || fallback;
    } catch (error) {
      this.logger.warn(
        `OpenAI request failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return fallback;
    }
  }

  private extractText(data: ResponsesApiResult) {
    if (data.output_text?.trim()) {
      return data.output_text.trim();
    }

    const text = data.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((value): value is string => Boolean(value?.trim()))
      .join('\n')
      .trim();

    return text;
  }
}
