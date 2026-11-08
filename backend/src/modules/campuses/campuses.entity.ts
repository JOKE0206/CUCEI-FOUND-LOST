export interface Campus {
  id: string;
  name: string;
  code: string;
  emailDomain: string | null;
}

export interface Location {
  id: string;
  campusId: string;
  name: string;
}
