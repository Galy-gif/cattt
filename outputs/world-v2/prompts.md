# World v2 prompts

Built-in image_gen; native outputs retained without upscaling. Generated fake checkerboards require deterministic alpha extraction before use.

## tree

Source: /Users/gouzi/.codex/generated_images/01a0863c-d765-7c00-b8d8-4fc4ff2427f7/exec-6fdfe459-7495-40b1-9778-7ffba949e15c.png

Use case: background-extraction. Extract ONLY the complete tree with canopy, trunk, roots and hanging basket. REMOVE scratching board (plain bark behind), surrounding plants, stump, house and all scenery. Match exact silhouette and proportions of this reference. Production game sprite with genuine transparent alpha background, no floor or shadow, complete roots and top, thin margins. Maintain soft flat felt material. Highest native resolution.

## house

Source: /Users/gouzi/.codex/generated_images/01a0863c-d765-7c00-b8d8-4fc4ff2427f7/exec-fe98c7dc-a1ce-41bf-821a-764dc43ef5ae.png

Use case: background-extraction. Extract ONLY mushroom house with chimney, door, window, doorstep and bowls. Remove background tree/sky/ground/plants. Preserve exact silhouette colors proportions. Game sprite, genuine transparent alpha background, no floor or shadow, complete edges, thin margins. Highest native resolution.

## grass

Source: /Users/gouzi/.codex/generated_images/01a0863c-d765-7c00-b8d8-4fc4ff2427f7/exec-6097f8f8-7df4-4778-92b9-ceb85e294143.png

Use case: background-extraction. Create one isolated grass clump matching these felt leaves and flowers, without rocks, pond or path. A wide tall clump with long blades in back and shorter round leaves with small daisies in front, suitable to conceal an orange cat's body behind its front leaves. Genuine transparent alpha background, no floor or shadow, complete uncropped silhouette. Maintain exact flat felt material and palette.

## bed

Source: /Users/gouzi/.codex/generated_images/01a0863c-d765-7c00-b8d8-4fc4ff2427f7/exec-9a18fc53-dd42-4fbf-a6d5-bf2d08372d52.png

Use case: background-extraction. Extract only the green cushion and woven rectangular mat. Same slightly overhead perspective, same felt cut-paper texture and shape. Complete corners. Genuine transparent alpha background, no floor, no extra shadows, no scenery. Highest native detail.

## treeRound

Source: /Users/gouzi/.codex/generated_images/01a0863c-d765-7c00-b8d8-4fc4ff2427f7/exec-2deeebed-1353-4607-8683-2936036c6e94.png

Extract the complete tree ONLY preserving this exact tall rounded lush crown and trunk proportions. Remove scratch board, ground, plants, house, rocks, stump and all backdrop. Keep hanging basket. Flat illustrated cut-paper soft felt texture, restrained sage/olive greens, no shiny clay, no oversaturated lime. Background MUST be completely solid pure magenta RGB255,0,255 for mechanical chroma key, NO checkerboard and NO gradients. NO cast shadow or floor. Full tree uncropped, narrow margin.

## sleepyV2

Source: /Users/gouzi/.codex/generated_images/01a0863c-d765-7c00-b8d8-4fc4ff2427f7/exec-d6df60b6-4b4f-45cc-a500-862e0a888fc8.png

Identity-preserving sprite animation revision. Produce exactly EIGHT full-body frames in a regular 4 columns x 2 rows grid, equal cells, row-major order. Same orange short round cat, flat wax-crayon with faint felt fiber, tiny brown mouth, forehead stripes, no white chest, no eye highlights. Sleepy nod full cycle: 1 awake front seated; 2 eyelids lowering; 3 head tilts down 10 degrees; 4 down20 degrees; 5 down25 degrees short pause; 6 up20;7 up10;8 awake. The complete rounded skull, two ears and face must remain anatomically distinct from chest in EVERY frame, especially lowest nod: NOT squashed, erased or merged into torso. Body/paws/tail positions identical across frames. Same scale and ground baseline within every cell; generous empty gap, no overlap. Solid pure MAGENTA #FF00FF background no checkerboard, no floor/shadow, no letters/labels/grid lines. All eight poses complete.

## tailV2

Source: /Users/gouzi/.codex/generated_images/01a0863c-d765-7c00-b8d8-4fc4ff2427f7/exec-a134dc36-7912-425d-9467-e1c8afb24871.png

Identity-preserving animation keyframe sheet. Exactly EIGHT full-body poses in 4 columns x 2 rows regular grid, equal cells row-major order. Same orange round short-legged cat, wax-crayon mostly with subtle felt texture, two black dot eyes tiny brown mouth, no white patches. Cat genuinely chasing its ringed tail through a clockwise FULL 360 degree turn ON THE GROUND. Fixed slightly elevated camera as reference, NEVER rotate the image plane. Cell1 facing FRONT, cell2 facing FRONT-RIGHT, cell3 RIGHT, cell4 BACK-RIGHT, cell5 BACK with face hidden, cell6 BACK-LEFT, cell7 LEFT, cell8 FRONT-LEFT. Each advances 45deg from previous. Body turns, paws step around small ground circle, head bends toward tail. Show correct back in cells4-6, no face visible through back of skull. Same cat body volume, ground rotation center and scale each cell. Full uncut tail and paws, generous empty cell margins. Solid pure MAGENTA #FF00FF background, no checkerboard/shadows/text/labels/grid lines. These are ordered keyframes not random cute poses.

## tailBetween

Source: /Users/gouzi/.codex/generated_images/01a0863c-d765-7c00-b8d8-4fc4ff2427f7/exec-79f2920e-4e9e-40d2-828c-76ce414d5ca5.png

Produce EIGHT INBETWEEN full-body frames for this exact chasing-tail cat animation in 4 columns x 2 rows regular grid. Same character proportions, colors, tiny brown mouth and subtle crayon/felt texture, fixed elevated camera, full paws and ringed tail in every cell. Each cell is HALF WAY between consecutive reference poses: cell1 halfway between ref1 and2 (front to front-right); cell2 between2and3; cell3 between3and4; cell4 between4and5 (mostly back); cell5 between5and6; cell6 between6and7; cell7 between7and8; cell8 between8and1. Thus first row turns toward back on right, second row turns back to front on left. Real body/paw turn on ground, no planar rotation. Do not repeat original keyframes. Uniform scale and rotation center. Solid pure MAGENTA #FF00FF, no checkerboard/text/shadows/grid lines.

## fenceV2

Source: /Users/gouzi/.codex/generated_images/01a0863c-d765-7c00-b8d8-4fc4ff2427f7/exec-5493b131-2f2b-41a6-a634-7665f7ff54da.png

Extract only this felt fence and orange mailbox with its attached small plants. Remove sky hills, ground, pond stones and path. Keep the open central passage. Preserve picture-book felt appearance, avoid glossy clay/plastic saturation. Whole fence uncropped. Solid pure MAGENTA #FF00FF background including gate opening and gaps, no checkerboard, no shadows or floor.

## boardV2

Source: /Users/gouzi/.codex/generated_images/01a0863c-d765-7c00-b8d8-4fc4ff2427f7/exec-7d4d9f03-5f6f-4daa-b2b2-84abdd78b6e2.png

Extract the single cream-colored vertical rope scratching BOARD from tree, front view slightly side-facing as reference. Only rope-wrapped rectangular board, no bark, cat, ground or shadow. Soft flat felt/crayon illustration matching reference, narrow tall rectangle with rounded rope edges. Solid pure MAGENTA #FF00FF background with generous margin, no checkerboard or text.

## cleanPlate

Source: /Users/gouzi/.codex/generated_images/01a0863c-d765-7c00-b8d8-4fc4ff2427f7/exec-beeaefd8-5865-435c-8cac-ff6a887aebe8.png

Precise-object-edit. Create CLEAN BACKGROUND PLATE for this exact composition. Remove the ENTIRE tree/crown/trunk/hanging basket/scratchboard and stump; remove house and bowls and round basket and green cushion/mat; remove fence and mailbox; remove ONLY foreground clump of grass and flowers left of pond. Fill former positions with matching blue sky, distant hills and grass continuously. Preserve exact pond, pale cool grey-green paths, distant vegetation, clouds, perspective, every unaffected pixel location. No new objects. Keep full 3:2 image framing and camera unchanged. Same soft flat felt illustration. No checkerboard, no blank holes. It will be used behind independent sprites.

## plateFinal

Source: /Users/gouzi/.codex/generated_images/01a0863c-d765-7c00-b8d8-4fc4ff2427f7/exec-d317672c-a997-4fd2-a849-0ed84c3b1006.png

Edit this clean felt landscape plate. Keep the upper sky hills and forest exactly. Lift pond and the main curved road slightly UP so the road's lowest center is y=0.81, and lower 15% is uninterrupted green grass. Pond now fits x .54-.87 y .64-.77. Add a connecting pale grey-green stone footpath from main road at (.34,.76) up to (.375,.64) where tree scratching board will go. Main road from (.17,.67) through (.22,.73),(.34,.76),(.47,.79),(.60,.82),(.76,.82),(.90,.77),(.94,.68). No tree, house, grass clump, cushion, fence, mailbox or animals. Smooth rich felt grass fill in all empty object positions. Image stays3:2. Do not change camera. Highest native detail.


