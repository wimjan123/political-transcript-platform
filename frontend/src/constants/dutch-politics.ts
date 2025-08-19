// Dutch Political Constants for Tweede Kamer
export const DUTCH_POLITICAL_PARTIES = [
  { code: 'VVD', name: 'Volkspartij voor Vrijheid en Democratie', color: '#0066CC' },
  { code: 'PVV', name: 'Partij voor de Vrijheid', color: '#FFD700' },
  { code: 'CDA', name: 'Christen-Democratisch Appèl', color: '#00AA44' },
  { code: 'D66', name: 'Democraten 66', color: '#FF6600' },
  { code: 'GL', name: 'GroenLinks', color: '#73BF00' },
  { code: 'SP', name: 'Socialistische Partij', color: '#FF0000' },
  { code: 'PvdA', name: 'Partij van de Arbeid', color: '#E50000' },
  { code: 'CU', name: 'ChristenUnie', color: '#00AADD' },
  { code: 'SGP', name: 'Staatkundig Gereformeerde Partij', color: '#FF8C00' },
  { code: 'DENK', name: 'DENK', color: '#00CED1' },
  { code: 'FvD', name: 'Forum voor Democratie', color: '#800080' },
  { code: 'PvdD', name: 'Partij voor de Dieren', color: '#006600' },
  { code: '50PLUS', name: '50PLUS', color: '#8B008B' },
  { code: 'VOLT', name: 'Volt Nederland', color: '#502379' },
  { code: 'JA21', name: 'JA21', color: '#1E90FF' },
  { code: 'BBB', name: 'BoerBurgerBeweging', color: '#228B22' },
] as const;

export const DUTCH_SPEAKER_ROLES = [
  { code: 'voorzitter', name: 'Voorzitter', description: 'Chairperson of the parliamentary session' },
  { code: 'minister', name: 'Minister', description: 'Government minister' },
  { code: 'staatssecretaris', name: 'Staatssecretaris', description: 'Secretary of State' },
  { code: 'minister-president', name: 'Minister-President', description: 'Prime Minister' },
  { code: 'kamerlid', name: 'Kamerlid', description: 'Member of Parliament' },
  { code: 'griffier', name: 'Griffier', description: 'Clerk of Parliament' },
] as const;

export const DUTCH_PARLIAMENTARY_PERIODS = [
  { code: '2021-2025', name: 'Kabinet Rutte IV (2021-2025)' },
  { code: '2017-2021', name: 'Kabinet Rutte III (2017-2021)' },
  { code: '2012-2017', name: 'Kabinet Rutte II (2012-2017)' },
  { code: '2010-2012', name: 'Kabinet Rutte I (2010-2012)' },
] as const;

// Helper functions
export const getPartyByCode = (code: string) => {
  return DUTCH_POLITICAL_PARTIES.find(party => party.code === code);
};

export const getSpeakerRoleByCode = (code: string) => {
  return DUTCH_SPEAKER_ROLES.find(role => role.code === code);
};

export const detectPartyFromSpeakerName = (speakerName: string): string | null => {
  // Simple detection based on common patterns
  // This could be enhanced with more sophisticated matching
  for (const party of DUTCH_POLITICAL_PARTIES) {
    if (speakerName.toLowerCase().includes(party.code.toLowerCase()) ||
        speakerName.toLowerCase().includes(party.name.toLowerCase())) {
      return party.code;
    }
  }
  return null;
};

export const detectSpeakerRole = (speakerName: string): string => {
  const name = speakerName.toLowerCase();
  
  if (name.includes('voorzitter')) return 'voorzitter';
  if (name.includes('minister-president')) return 'minister-president';
  if (name.includes('minister')) return 'minister';
  if (name.includes('staatssecretaris')) return 'staatssecretaris';
  if (name.includes('griffier')) return 'griffier';
  
  return 'kamerlid'; // Default to MP
};