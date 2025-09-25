export interface Photo {
  id: string;
  uri: string;
  width?: number;
  height?: number;
  scenario?: string;
  watermarked?: boolean;
  premium?: boolean;
}

export interface User {
  id: string;
  email?: string;
  name?: string;
  createdAt: Date;
}

export interface Purchase {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
}

export interface GenerationHistory {
  id: string;
  userId: string;
  scenarios: string[];
  photoCount: number;
  createdAt: Date;
}

export type Scenario = 
  | 'beach'
  | 'gym'
  | 'formal'
  | 'casual'
  | 'nature'
  | 'urban'
  | 'coffee'
  | 'travel';

export interface ScenarioOption {
  id: Scenario;
  title: string;
  description: string;
  icon: string;
  gradient: [string, string];
}

export interface LoadingStep {
  id: number;
  text: string;
  duration: number;
}