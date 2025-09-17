export interface GeneratedImage {
  id: string;
  base64: string;
}

export interface Project {
  id: string;
  referenceImage: {
    base64: string;
    name: string;
    mimeType: string;
  };
  stylePrompt: string;
  modificationPrompt: string;
  generatedImages: GeneratedImage[];
  createdAt: string; // ISO string
}

export type Theme = 'dark' | 'light' | 'fluorescent' | 'oceanic' | 'crimson-night' | 'sakura';

export interface Settings {
  theme: Theme;
  useOpenAICompatibleEndpoint: boolean;
  openaiApiUrl: string;
  openaiModelId: string;
  openaiApiKey: string;
}

export type NewProjectImageState = {
    id: string; // Unique ID for React key prop
    file: File;
    base64: string; // Raw base64, without prefix
    mimeType: string;
    base64WithPrefix: string; // data:image/...;base64,...
};