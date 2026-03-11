export type RootStackParamList = {
  Tabs: undefined;
  Recording: { source?: 'home' | 'create' } | undefined;
  TypeNote: { source?: 'home' | 'create' } | undefined;
  EntryDetail: { entryId: string };
  ProjectDetail: { projectId: string };
  Studio: { projectId: string };
  Output: { draftId: string };
};

export type RootTabParamList = {
  Home: undefined;
  Vault: undefined;
  Create: undefined;
  Projects: undefined;
  Profile: undefined;
};
