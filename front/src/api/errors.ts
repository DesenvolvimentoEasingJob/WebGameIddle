export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

interface ProblemDetails {
  title?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

export function formatApiError(err: unknown, fallback: string): string {
  if (typeof err !== "object" || err === null) return fallback;

  const body = err as ApiError & ProblemDetails;

  if (body.errors) {
    const messages = Object.values(body.errors).flat().filter(Boolean);
    if (messages.length > 0) return messages.join(" ");
  }

  if (body.message) return body.message;
  if (body.title) return body.title;

  return fallback;
}

export async function readApiError(response: Response, fallback: string): Promise<ApiError> {
  const body = await parseJson<ApiError & ProblemDetails>(response);

  if (!body) return { message: fallback };

  const errors = body.errors;
  const message =
    (errors && Object.values(errors).flat().filter(Boolean).join(" ")) ||
    body.message ||
    body.title ||
    fallback;

  return { message, errors };
}

async function parseJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
