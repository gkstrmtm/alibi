export type RootStackParamList = {
  Tabs: undefined;
  Create: undefined;
  Recording:
    | {
        source?: 'home' | 'create' | 'project' | 'studio' | 'intake' | 'vault' | 'output';
        projectId?: string;
        draftId?: string;
        returnTo?: 'entry' | 'project' | 'studio' | 'output';
        intakeKey?: 'make' | 'forWho' | 'rules';
        promptLabel?: string;
        targetProperty?: 'brief.premise' | 'brief.audience' | 'brief.tone';
      }
    | undefined;
  TypeNote:
    | {
        source?: 'home' | 'create' | 'project' | 'studio' | 'intake' | 'vault' | 'output';
        projectId?: string;
        draftId?: string;
        returnTo?: 'tabs' | 'project' | 'studio' | 'output';
        intakeKey?: 'make' | 'forWho' | 'rules';
        promptLabel?: string;
      }
    | undefined;
  EntryDetail: { entryId: string; autoExtract?: boolean };
  ProjectDetail: { projectId: string; toastMessage?: string };
  NewProject:
    | { attachEntryId?: string; initialType?: 'standard' | 'book'; afterCreate?: 'entry' | 'project' }
    | undefined;
  SelectProject: { entryId: string; onlyBook?: boolean };
  SelectEntries: { projectId: string };
  Studio: { projectId: string };
  ProjectSettings: { projectId: string; focusSection?: 'brief' | 'canon' | 'outline' };
  Output: { draftId: string };
  Auth: undefined;
  ApiSettings: undefined;
};

export type RootTabParamList = {
  Home: undefined;
  Vault: undefined;
  Projects: undefined;
  Profile: undefined;
};
