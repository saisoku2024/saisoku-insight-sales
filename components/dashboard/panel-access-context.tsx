"use client"

import { createContext, useContext, type ReactNode } from "react"

export type PanelRole = "owner" | "admin" | "viewer"

const PanelRoleContext = createContext<PanelRole>("viewer")

export function PanelRoleProvider({
  role,
  children,
}: {
  role: PanelRole
  children: ReactNode
}) {
  return <PanelRoleContext.Provider value={role}>{children}</PanelRoleContext.Provider>
}

export function usePanelRole() {
  return useContext(PanelRoleContext)
}

export function useIsViewer() {
  return usePanelRole() === "viewer"
}

export const viewerOnlyTitle = "Viewer mode: read-only"
