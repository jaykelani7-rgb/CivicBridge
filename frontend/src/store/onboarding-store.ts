import { create } from "zustand";

export type UserRole =
  | "ADMIN"
  | "COORDINATOR"
  | "VOLUNTEER"
  | "FIELD_WORKER"
  | "CSR_DONOR";

type AuthMode = "signup" | "signin";

type BasicProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
};

type VolunteerProfile = {
  skills: string[];
  languages: string[];
  availability: string;
};

type DonorProfile = {
  companyName: string;
  department: string;
  companySize: string;
  fundingFocus: string[];
  setupComplete: boolean;
};

type OnboardingState = {
  mode: AuthMode;
  role: UserRole;
  basic: BasicProfile;
  volunteer: VolunteerProfile;
  donor: DonorProfile;
  setMode: (mode: AuthMode) => void;
  setRole: (role: UserRole) => void;
  updateBasic: (value: Partial<BasicProfile>) => void;
  updateVolunteer: (value: Partial<VolunteerProfile>) => void;
  updateDonor: (value: Partial<DonorProfile>) => void;
  reset: () => void;
};

const initialState = {
  mode: "signup" as AuthMode,
  role: "VOLUNTEER" as UserRole,
  basic: {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  },
  volunteer: {
    skills: [],
    languages: [],
    availability: "",
  },
  donor: {
    companyName: "",
    department: "",
    companySize: "",
    fundingFocus: [],
    setupComplete: false,
  },
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,
  setMode: (mode) => set({ mode }),
  setRole: (role) => set({ role }),
  updateBasic: (value) =>
    set((state) => ({ basic: { ...state.basic, ...value } })),
  updateVolunteer: (value) =>
    set((state) => ({ volunteer: { ...state.volunteer, ...value } })),
  updateDonor: (value) => set((state) => ({ donor: { ...state.donor, ...value } })),
  reset: () => set(initialState),
}));
