export interface QuestionOptionDto {
  id: string;
  orden: number;
  textoHtml: string;
  esCorrecta: boolean;
  fraction: number;
  extraJson?: string | null;
}

export interface QuestionDto {
  id: string;
  tipo: string;
  enunciadoHtml: string;
  defaultGrade: number;
  generalFeedbackHtml?: string | null;
  datosJson?: string | null;
  orden: number;
  noPuntua: boolean;
  options: QuestionOptionDto[];
}

export interface QuestionsResponse {
  success: boolean;
  questions: QuestionDto[];
  puntajeMaximo: number;
  error?: string;
}

export interface QuizImportReport {
  quizId: string;
  creadas: number;
  omitidas: number;
  imagenesImportadas: number;
  advertencias: string[];
}

