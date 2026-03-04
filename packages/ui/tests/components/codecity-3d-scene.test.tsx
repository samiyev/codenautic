import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
    CodeCity3DScene,
    type TCodeCityCameraPreset,
    type ICodeCity3DSceneImpactedFileDescriptor,
    type ICodeCity3DSceneFileDescriptor,
} from "@/components/graphs/codecity-3d-scene"
import { renderWithProviders } from "../utils/render"

vi.mock("@/components/graphs/codecity-3d-scene-renderer", () => {
    return {
        CodeCity3DSceneRenderer: (props: {
            readonly cameraPreset: TCodeCityCameraPreset
            readonly files: ReadonlyArray<ICodeCity3DSceneFileDescriptor>
            readonly impactedFiles: ReadonlyArray<ICodeCity3DSceneImpactedFileDescriptor>
            readonly selectedFileId?: string
            readonly onBuildingHover?: (fileId: string | undefined) => void
            readonly onBuildingSelect?: (fileId: string | undefined) => void
        }): React.JSX.Element => {
            return (
                <div>
                    renderer-files:{props.files.length};impacts:{props.impactedFiles.length};preset:
                    {props.cameraPreset}
                    ;selected:{props.selectedFileId ?? "none"}
                    <button
                        onClick={(): void => {
                            props.onBuildingHover?.(props.files[0]?.id)
                        }}
                        type="button"
                    >
                        mock hover building
                    </button>
                    <button
                        onClick={(): void => {
                            props.onBuildingSelect?.(props.files[0]?.id)
                        }}
                        type="button"
                    >
                        mock select building
                    </button>
                </div>
            )
        },
    }
})

const TEST_FILES: ReadonlyArray<ICodeCity3DSceneFileDescriptor> = [
    {
        complexity: 24,
        coverage: 82,
        id: "src/api/repository.ts",
        loc: 126,
        path: "src/api/repository.ts",
    },
]
const TEST_IMPACTED_FILES: ReadonlyArray<ICodeCity3DSceneImpactedFileDescriptor> = [
    {
        fileId: "src/api/repository.ts",
        impactType: "changed",
    },
]

describe("CodeCity3DScene", (): void => {
    it("показывает fallback при отсутствии WebGL", (): void => {
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((): GPUCanvasContext | null => null)

        renderWithProviders(<CodeCity3DScene files={TEST_FILES} title="3D fallback scene" />)
        expect(screen.getByRole("status")).toHaveTextContent("WebGL unavailable")
        getContextSpy.mockRestore()
    })

    it("лениво загружает renderer при доступном WebGL", async (): Promise<void> => {
        const fakeContext = {} as GPUCanvasContext
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((): GPUCanvasContext => fakeContext)

        renderWithProviders(<CodeCity3DScene files={TEST_FILES} title="3D loaded scene" />)
        await waitFor((): void => {
            expect(
                screen.getByText("renderer-files:1;impacts:0;preset:bird-eye;selected:none"),
            ).not.toBeNull()
        })
        getContextSpy.mockRestore()
    })

    it("переключает camera preset между bird eye, street level и focus building", async (): Promise<void> => {
        const user = userEvent.setup()
        const fakeContext = {} as GPUCanvasContext
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((): GPUCanvasContext => fakeContext)

        renderWithProviders(
            <CodeCity3DScene
                files={TEST_FILES}
                impactedFiles={TEST_IMPACTED_FILES}
                title="3D preset scene"
            />,
        )
        await waitFor((): void => {
            expect(
                screen.getByText("renderer-files:1;impacts:1;preset:bird-eye;selected:none"),
            ).not.toBeNull()
        })

        await user.click(screen.getByRole("button", { name: "Camera preset Street level" }))
        await waitFor((): void => {
            expect(
                screen.getByText("renderer-files:1;impacts:1;preset:street-level;selected:none"),
            ).not.toBeNull()
        })

        await user.click(screen.getByRole("button", { name: "Camera preset Focus building" }))
        await waitFor((): void => {
            expect(
                screen.getByText("renderer-files:1;impacts:1;preset:focus-on-building;selected:none"),
            ).not.toBeNull()
        })

        getContextSpy.mockRestore()
    })

    it("показывает tooltip при hover и side panel при клике по зданию", async (): Promise<void> => {
        const user = userEvent.setup()
        const fakeContext = {} as GPUCanvasContext
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((): GPUCanvasContext => fakeContext)

        renderWithProviders(
            <CodeCity3DScene
                files={TEST_FILES}
                impactedFiles={TEST_IMPACTED_FILES}
                title="3D interaction scene"
            />,
        )

        await user.click(screen.getByRole("button", { name: "mock hover building" }))
        expect(screen.getByText("Hover preview")).not.toBeNull()
        expect(screen.getByText("src/api/repository.ts")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "mock select building" }))
        expect(screen.getByText("File details")).not.toBeNull()
        expect(screen.getByText("Coverage")).not.toBeNull()

        getContextSpy.mockRestore()
    })
})
