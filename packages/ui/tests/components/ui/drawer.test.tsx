import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Drawer, DrawerBody, DrawerContent, DrawerHeader } from "@/components/ui/drawer"
import { renderWithProviders } from "../../utils/render"

describe("Drawer", (): void => {
    it("when isOpen is true, then renders drawer content", (): void => {
        renderWithProviders(
            <Drawer isOpen>
                <DrawerContent>
                    <DrawerHeader>Drawer Title</DrawerHeader>
                    <DrawerBody>Drawer body text</DrawerBody>
                </DrawerContent>
            </Drawer>,
        )

        expect(screen.getByText("Drawer Title")).not.toBeNull()
        expect(screen.getByText("Drawer body text")).not.toBeNull()
    })

    it("when isOpen is false, then does not render content", (): void => {
        renderWithProviders(
            <Drawer isOpen={false}>
                <DrawerContent>
                    <DrawerBody>Hidden drawer</DrawerBody>
                </DrawerContent>
            </Drawer>,
        )

        expect(screen.queryByText("Hidden drawer")).toBeNull()
    })

    it("when DrawerHeader has children, then renders header", (): void => {
        renderWithProviders(
            <Drawer isOpen>
                <DrawerContent>
                    <DrawerHeader>Settings</DrawerHeader>
                </DrawerContent>
            </Drawer>,
        )

        expect(screen.getByText("Settings")).not.toBeNull()
    })
})
