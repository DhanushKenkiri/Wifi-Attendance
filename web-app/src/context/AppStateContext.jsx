import React, { createContext, useContext, useMemo, useReducer } from 'react';

const initialState = {
  step: 'code-entry',
  codeData: null,
  authUser: null,
  attendanceResult: null,
  toast: null,
};

const actions = {
  SET_STEP: 'SET_STEP',
  SET_CODE_DATA: 'SET_CODE_DATA',
  SET_AUTH_USER: 'SET_AUTH_USER',
  SET_ATTENDANCE_RESULT: 'SET_ATTENDANCE_RESULT',
  SET_TOAST: 'SET_TOAST',
  RESET: 'RESET',
};

const reducer = (state, action) => {
  switch (action.type) {
    case actions.SET_STEP:
      return { ...state, step: action.payload };
    case actions.SET_CODE_DATA:
      return { ...state, codeData: action.payload };
    case actions.SET_AUTH_USER:
      return { ...state, authUser: action.payload };
    case actions.SET_ATTENDANCE_RESULT:
      return { ...state, attendanceResult: action.payload };
    case actions.SET_TOAST:
      return { ...state, toast: action.payload };
    case actions.RESET:
      return { ...initialState };
    default:
      return state;
  }
};

const AppStateContext = createContext({ state: initialState, dispatch: () => {} });

export const AppStateProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
};

export const useAppState = () => useContext(AppStateContext);
export const AppStateActions = actions;
