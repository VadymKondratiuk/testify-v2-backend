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

type GeminiGenerateContentResult = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

type NvidiaChatCompletionResult = {
  requestId?: string;
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  choices?: Array<{
    text?: string;
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>;
    };
  }>;
};

const openAiResponsesUrl = 'https://api.openai.com/v1/responses';
const geminiGenerateContentBaseUrl =
  'https://generativelanguage.googleapis.com/v1beta/models';
const nvidiaApiBaseUrl = 'https://integrate.api.nvidia.com/v1';
const nvidiaChatCompletionsPath = 'chat/completions';
const defaultNvidiaModel = 'meta/llama-4-maverick-17b-128e-instruct';
const studyCoachSystemPrompt =
  'You are an encouraging study coach for an online testing platform. ' +
  'Generate one concise recommendation for the student. ' +
  'Use only the provided facts. Do not invent scores, tests, or topics. ' +
  'Write in English, 2-4 sentences, practical and specific.';

@Injectable()
export class AiStudyCoachService {
  private readonly logger = new Logger(AiStudyCoachService.name);

  async generateStudyRecommendation(input: StudyCoachInput, fallback: string) {
    const provider = (process.env.AI_PROVIDER ?? 'auto').toLowerCase();

    if (provider === 'gemini') {
      return this.generateWithGemini(input, fallback);
    }

    if (provider === 'openai') {
      return this.generateWithOpenAi(input, fallback);
    }

    if (provider === 'nvidia') {
      return this.generateWithNvidia(input, fallback);
    }

    const nvidiaResult = await this.generateWithNvidia(input);

    if (nvidiaResult) {
      return nvidiaResult;
    }

    const geminiResult = await this.generateWithGemini(input);

    if (geminiResult) {
      return geminiResult;
    }

    return this.generateWithOpenAi(input, fallback);
  }

  private async generateWithGemini(input: StudyCoachInput, fallback?: string) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return fallback;
    }

    const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    const url = `${geminiGenerateContentBaseUrl}/${model}:generateContent`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: studyCoachSystemPrompt }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: JSON.stringify(input) }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 180,
            temperature: 0.4,
          },
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        this.logger.warn(
          `Gemini request failed: ${response.status} ${message}`,
        );
        return fallback;
      }

      const data = (await response.json()) as GeminiGenerateContentResult;
      const text = this.extractGeminiText(data);

      return text || fallback;
    } catch (error) {
      this.logger.warn(
        `Gemini request failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return fallback;
    }
  }

  private async generateWithNvidia(input: StudyCoachInput, fallback?: string) {
    const apiKey = process.env.NVIDIA_API_KEY;

    if (!apiKey) {
      return fallback;
    }

    const baseUrl = this.getNvidiaBaseUrl();
    const model = process.env.NVIDIA_MODEL ?? defaultNvidiaModel;
    const url =
      process.env.NVIDIA_CHAT_COMPLETIONS_URL?.trim() ||
      `${baseUrl}/${nvidiaChatCompletionsPath}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: studyCoachSystemPrompt,
            },
            {
              role: 'user',
              content: `Student result JSON:\n${JSON.stringify(input)}`,
            },
          ],
          max_tokens: 180,
          temperature: 0.4,
          top_p: 0.9,
          stream: false,
        }),
      });

      return this.handleNvidiaResponse(response, apiKey, baseUrl, fallback);
    } catch (error) {
      this.logger.warn(
        `NVIDIA request failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return fallback;
    }
  }

  private getNvidiaBaseUrl() {
    return (process.env.NVIDIA_API_BASE_URL ?? nvidiaApiBaseUrl).replace(
      /\/+$/,
      '',
    );
  }

  private async generateWithOpenAi(input: StudyCoachInput, fallback: string) {
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
                  text: studyCoachSystemPrompt,
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
        this.logger.warn(
          `OpenAI request failed: ${response.status} ${message}`,
        );
        return fallback;
      }

      const data = (await response.json()) as ResponsesApiResult;
      const text = this.extractOpenAiText(data);

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

  private extractOpenAiText(data: ResponsesApiResult) {
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

  private async handleNvidiaResponse(
    response: Response,
    apiKey: string,
    baseUrl: string,
    fallback?: string,
  ) {
    const data = await this.readNvidiaJson(response);

    if (response.status === 202) {
      const requestId = this.extractNvidiaRequestId(response, data);

      if (!requestId) {
        this.logger.warn(
          'NVIDIA request is pending, but requestId is missing.',
        );
        return fallback;
      }

      return this.pollNvidiaResult(requestId, apiKey, baseUrl, fallback);
    }

    if (!response.ok) {
      this.logger.warn(
        `NVIDIA request failed: ${response.status} ${JSON.stringify(data)}`,
      );
      return fallback;
    }

    const text = this.extractNvidiaText(data);

    return text || fallback;
  }

  private async pollNvidiaResult(
    requestId: string,
    apiKey: string,
    baseUrl: string,
    fallback?: string,
  ) {
    const url = `${baseUrl}/status/${requestId}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await this.delay(1000 * (attempt + 1));

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      });
      const data = await this.readNvidiaJson(response);

      if (response.status === 202) {
        continue;
      }

      if (!response.ok) {
        this.logger.warn(
          `NVIDIA polling failed: ${response.status} ${JSON.stringify(data)}`,
        );
        return fallback;
      }

      const text = this.extractNvidiaText(data);

      return text || fallback;
    }

    this.logger.warn('NVIDIA request is still pending after polling.');
    return fallback;
  }

  private async readNvidiaJson(response: Response) {
    const text = await response.text();

    if (!text.trim()) {
      return {} as NvidiaChatCompletionResult;
    }

    try {
      return JSON.parse(text) as NvidiaChatCompletionResult;
    } catch {
      return { output_text: text };
    }
  }

  private extractNvidiaRequestId(
    response: Response,
    data: NvidiaChatCompletionResult,
  ) {
    return (
      data.requestId ??
      response.headers.get('nvcf-reqid') ??
      response.headers.get('nvcf-request-id') ??
      response.headers.get('request-id') ??
      response.headers.get('x-request-id') ??
      undefined
    );
  }

  private extractNvidiaText(data: NvidiaChatCompletionResult) {
    if (data.output_text?.trim()) {
      return data.output_text.trim();
    }

    const outputText = data.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((value): value is string => Boolean(value?.trim()))
      .join('\n')
      .trim();

    if (outputText) {
      return outputText;
    }

    const choiceText = data.choices
      ?.map((choice) => {
        const content = choice.message?.content;

        if (typeof content === 'string') {
          return content;
        }

        if (Array.isArray(content)) {
          return content
            .map((item) => item.text)
            .filter((value): value is string => Boolean(value?.trim()))
            .join('\n');
        }

        return choice.text;
      })
      .filter((value): value is string => Boolean(value?.trim()))
      .join('\n')
      .trim();

    return choiceText;
  }

  private extractGeminiText(data: GeminiGenerateContentResult) {
    return data.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text)
      .filter((value): value is string => Boolean(value?.trim()))
      .join('\n')
      .trim();
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
