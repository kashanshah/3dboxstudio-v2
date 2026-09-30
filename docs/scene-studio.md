# Scene Studio architecture

Scene Studio is a composition/rendering workspace separate from Box Studio.

## Product boundary

- **Box Studio** owns package structure, dimensions, material, artwork, folding/opening and color-proofing.
- **Scene Studio** owns composition: multiple package objects, transforms, props, backgrounds, authored lighting, shadows, cameras, environments and rendered outputs.
- A scene references a saved Box Studio design by `sourceDesignId`. It does not duplicate the box project state.

This lets the same packaging design appear in many scenes and allows edits to the source package to remain reusable.

## Default scene

A new scene is intentionally empty:

- no objects
- transparent background
- no authored lights
- shadows disabled
- default perspective camera
- no environment map

Box Studio remains the true-color design/proofing workspace. Photographic lighting begins only after the user enters Scene Studio and adds it deliberately.

## Scene object model

Initial scene objects reference Box Studio projects. The object abstraction is intentionally broader so later releases can support:

- bottles, jars, pouches and other native packaging
- imported GLB/GLTF/OBJ assets
- studio props
- plinths, blocks, tables and floors
- text or image planes

Every object needs transform, visibility, selection and layer ordering/scene-tree behavior.

## Planned scene systems

1. **Objects** — add saved boxes, duplicate, group, lock, hide, transform and align.
2. **Background** — transparent, color/gradient, image, generated background.
3. **Lighting** — area/softbox, directional, point, spot, rim/fill/key presets.
4. **Shadows** — contact shadow, ground receiver, opacity, softness, direction.
5. **Camera** — transform, target, focal length, perspective, aspect ratios, depth of field and saved shots.
6. **Environment** — HDRI/studio maps, reflection intensity, rotation and ground/environment separation.
7. **Materials/rendering** — photographic response belongs to scene rendering while source artwork/color remains unchanged.
8. **Export** — PNG with alpha, JPG/WebP, 2K/4K/8K stills, animation/video, share links.
9. **Scene presets** — ecommerce white sweep, soft studio, dark luxury, tabletop, floating product, hero lighting.
10. **AI-assisted studio** — generated backgrounds or scene suggestions must remain editable as normal scene components.

## Pacdora reference

Pacdora publicly describes a workflow where multiple mockups/elements are combined in a 3D scene, positioned freely, then lighting, shadows and backgrounds are adjusted before high-resolution rendering. Our architecture follows the useful separation of concerns but keeps packaging authoring and scene composition as distinct reusable project types.
