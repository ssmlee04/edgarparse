export type XBRLFact = {
    concept: string;
    label: string;
    value: number;
    unit: 'USD';
};

export type PeriodFacts = {
    startDate: string;
    endDate: string;
    months: number;
    facts: XBRLFact[];
};

export type ContextInfo = {
    type: 'instant' | 'duration';
    date?: string;
    startDate?: string;
    endDate?: string;
    hasSegment: boolean;
};

export type RawFact = {
    concept: string;
    contextRef: string;
    unitRef: string;
    value: number;
};
