export interface TimelineItem {
  date: string;
  event: string;
  description: string;
}

export interface OpinionSummary {
  id: number;
  content: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  source: string;
  count: number;
}

export interface RelatedEvent {
  id: number;
  title: string;
  type: 'video' | 'image' | 'audio' | 'text';
  sentiment: 'positive' | 'neutral' | 'negative';
  source: string;
  time: string;
  description: string;
}

export interface EventDetail {
  title: string;
  area: string;
  description: string;
  heatValue: number;
  date: string;
}
