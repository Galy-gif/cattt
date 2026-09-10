# v2 图像制作提示词

> 图像生成后仅做确定性切帧、透明导出、尺寸向下统一与合成。原生分区输入保留在 tiles/。

## background

Edit target: provided selected felt courtyard. Make the approved expanded master composition for a 2D iOS world. Keep exact soft flat illustrated felt/cut-paper material, colors, gentle afternoon light, left mushroom house, central large tree and hanging basket and attached vertical cream rope scratching BOARD, right pond and fence. Expand UP to complete the entire round GREEN TREE CROWN with sky above it, and DOWN to more grass. Wide 5:3 composition, target 5600x3360 pixels if supported, highest native detail possible. Tree top within frame with at least 6% sky margin. Add a continuous walkable low-saturation cool pale limestone-green PATH from the mushroom doorstep, passing in front of tree and grass, around the FRONT/BOTTOM of pond, then joining fence path. Main path center y around 0.79, width 0.06 of image height, no path crossing water. Short connecting paths to house door, tree scratching board, cushion at left front, a distinct tall grass clump near middle left of pond, and fence. Keep main path above bottom 15% of image reserved foreground grass. Avoid warm orange road (orange cat must stand out). Tree roots at approx (0.38,0.61), mushroom door at (0.15,0.59), pond occupies x .60-.87 y .59-.73. A small green cushion at (.22,.73). Fence gate (.90,.62). Tree and house should still be large recognisable objects. No cats, characters, text, UI, marks, borders. This is one continuous full landscape, not panels. Preserve selected art language, do not become 3D toy render.

## backgroundCorrection

Precise edit of this courtyard composition. Keep house, tree trunk, scratching board, pond, fence and connecting path locations and all artwork details. ONLY fix upper framing and path color: the tree crown must NOT touch the top edge. There MUST be an uninterrupted blue sky strip from y=0 to 0.065 full width, and the tree crown must start below y=0.07. Compact just the upper crown vertically to fit; do not move trunk or ground. Change sandy peach path to pale COOL grey-green limestone, not beige or orange. Keep 5:3 full image composition. No cat or text. Highest native resolution available.

## roundCrown

EDIT ONLY by extending canvas UPWARD. The tree crown in this image has been flattened, which the user rejected. Restore a taller rounded dome canopy with organically layered rounded leaf clusters, as lush and full as the original tree. Add additional SKY ABOVE to accommodate this rounded canopy, instead of squashing leaves. Keep ALL existing lower scene geometry: house, trunk, scratch board, pond, road, foreground in the same positions relative to each other and same sizes. Output aspect 3:2 now, allowing extra top space. Minimum sky margin above the crown 5% of image height. Preserve flat felt picture-book material and subdued original color, NOT glossy clay or plastic or oversaturated lime. No cats, text or UI. Highest native detail.

## cleanPlate

Precise-object-edit. Create CLEAN BACKGROUND PLATE for this exact composition. Remove the ENTIRE tree/crown/trunk/hanging basket/scratchboard and stump; remove house and bowls and round basket and green cushion/mat; remove fence and mailbox; remove ONLY foreground clump of grass and flowers left of pond. Fill former positions with matching blue sky, distant hills and grass continuously. Preserve exact pond, pale cool grey-green paths, distant vegetation, clouds, perspective, every unaffected pixel location. No new objects. Keep full 3:2 image framing and camera unchanged. Same soft flat felt illustration. No checkerboard, no blank holes. It will be used behind independent sprites.

## plateFinal

Edit this clean felt landscape plate. Keep the upper sky hills and forest exactly. Lift pond and the main curved road slightly UP so the road's lowest center is y=0.81, and lower 15% is uninterrupted green grass. Pond now fits x .54-.87 y .64-.77. Add a connecting pale grey-green stone footpath from main road at (.34,.76) up to (.375,.64) where tree scratching board will go. Main road from (.17,.67) through (.22,.73),(.34,.76),(.47,.79),(.60,.82),(.76,.82),(.90,.77),(.94,.68). No tree, house, grass clump, cushion, fence, mailbox or animals. Smooth rich felt grass fill in all empty object positions. Image stays3:2. Do not change camera. Highest native detail.

## tree

Use case: background-extraction. Extract ONLY the complete tree with canopy, trunk, roots and hanging basket. REMOVE scratching board (plain bark behind), surrounding plants, stump, house and all scenery. Match exact silhouette and proportions of this reference. Production game sprite with genuine transparent alpha background, no floor or shadow, complete roots and top, thin margins. Maintain soft flat felt material. Highest native resolution.

## house

Use case: background-extraction. Extract ONLY mushroom house with chimney, door, window, doorstep and bowls. Remove background tree/sky/ground/plants. Preserve exact silhouette colors proportions. Game sprite, genuine transparent alpha background, no floor or shadow, complete edges, thin margins. Highest native resolution.

## grass

Use case: background-extraction. Create one isolated grass clump matching these felt leaves and flowers, without rocks, pond or path. A wide tall clump with long blades in back and shorter round leaves with small daisies in front, suitable to conceal an orange cat's body behind its front leaves. Genuine transparent alpha background, no floor or shadow, complete uncropped silhouette. Maintain exact flat felt material and palette.

## bed

Use case: background-extraction. Extract only the green cushion and woven rectangular mat. Same slightly overhead perspective, same felt cut-paper texture and shape. Complete corners. Genuine transparent alpha background, no floor, no extra shadows, no scenery. Highest native detail.

## treeRound

Extract the complete tree ONLY preserving this exact tall rounded lush crown and trunk proportions. Remove scratch board, ground, plants, house, rocks, stump and all backdrop. Keep hanging basket. Flat illustrated cut-paper soft felt texture, restrained sage/olive greens, no shiny clay, no oversaturated lime. Background MUST be completely solid pure magenta RGB255,0,255 for mechanical chroma key, NO checkerboard and NO gradients. NO cast shadow or floor. Full tree uncropped, narrow margin.

## fenceV2

Extract only this felt fence and orange mailbox with its attached small plants. Remove sky hills, ground, pond stones and path. Keep the open central passage. Preserve picture-book felt appearance, avoid glossy clay/plastic saturation. Whole fence uncropped. Solid pure MAGENTA #FF00FF background including gate opening and gaps, no checkerboard, no shadows or floor.

## boardV2

Extract the single cream-colored vertical rope scratching BOARD from tree, front view slightly side-facing as reference. Only rope-wrapped rectangular board, no bark, cat, ground or shadow. Soft flat felt/crayon illustration matching reference, narrow tall rectangle with rounded rope edges. Solid pure MAGENTA #FF00FF background with generous margin, no checkerboard or text.

## sleepyV2

Identity-preserving sprite animation revision. Produce exactly EIGHT full-body frames in a regular 4 columns x 2 rows grid, equal cells, row-major order. Same orange short round cat, flat wax-crayon with faint felt fiber, tiny brown mouth, forehead stripes, no white chest, no eye highlights. Sleepy nod full cycle: 1 awake front seated; 2 eyelids lowering; 3 head tilts down 10 degrees; 4 down20 degrees; 5 down25 degrees short pause; 6 up20;7 up10;8 awake. The complete rounded skull, two ears and face must remain anatomically distinct from chest in EVERY frame, especially lowest nod: NOT squashed, erased or merged into torso. Body/paws/tail positions identical across frames. Same scale and ground baseline within every cell; generous empty gap, no overlap. Solid pure MAGENTA #FF00FF background no checkerboard, no floor/shadow, no letters/labels/grid lines. All eight poses complete.

## tailV2

Identity-preserving animation keyframe sheet. Exactly EIGHT full-body poses in 4 columns x 2 rows regular grid, equal cells row-major order. Same orange round short-legged cat, wax-crayon mostly with subtle felt texture, two black dot eyes tiny brown mouth, no white patches. Cat genuinely chasing its ringed tail through a clockwise FULL 360 degree turn ON THE GROUND. Fixed slightly elevated camera as reference, NEVER rotate the image plane. Cell1 facing FRONT, cell2 facing FRONT-RIGHT, cell3 RIGHT, cell4 BACK-RIGHT, cell5 BACK with face hidden, cell6 BACK-LEFT, cell7 LEFT, cell8 FRONT-LEFT. Each advances 45deg from previous. Body turns, paws step around small ground circle, head bends toward tail. Show correct back in cells4-6, no face visible through back of skull. Same cat body volume, ground rotation center and scale each cell. Full uncut tail and paws, generous empty cell margins. Solid pure MAGENTA #FF00FF background, no checkerboard/shadows/text/labels/grid lines. These are ordered keyframes not random cute poses.

## tailBetween

Produce EIGHT INBETWEEN full-body frames for this exact chasing-tail cat animation in 4 columns x 2 rows regular grid. Same character proportions, colors, tiny brown mouth and subtle crayon/felt texture, fixed elevated camera, full paws and ringed tail in every cell. Each cell is HALF WAY between consecutive reference poses: cell1 halfway between ref1 and2 (front to front-right); cell2 between2and3; cell3 between3and4; cell4 between4and5 (mostly back); cell5 between5and6; cell6 between6and7; cell7 between7and8; cell8 between8and1. Thus first row turns toward back on right, second row turns back to front on left. Real body/paw turn on ground, no planar rotation. Do not repeat original keyframes. Uniform scale and rotation center. Solid pure MAGENTA #FF00FF, no checkerboard/text/shadows/grid lines.

## walkToward

SIX consecutive frames, 3columns x2rows equal grid of this EXACT cat walking diagonally TOWARD viewer and to the RIGHT, fixed three-quarter front view. Cat is on ground, complete alternating paw walk cycle. Preserve thick round orange torso, short legs, striped ringed tail, tiny black dot eyes, no white belly, subtle flat wax-crayon/felt. All cells same view, body scale and ground baseline, generous gap, no overlaps. Solid pure MAGENTA #FF00FF background, no checkerboard or shadows/text/gridlines. This must be a walking cycle, not six unrelated poses.

## walkAway

SIX consecutive frames, 3columns x2rows equal grid of this EXACT cat walking diagonally AWAY from viewer and to the RIGHT, three-quarter BACK view. Back of head/ears visible, mostly no face. Complete alternating paw walk cycle on ground. Preserve thick round orange torso, short legs, striped ringed tail, no white belly, subtle flat wax-crayon/felt. All cells same view, body scale and ground baseline, generous gap, no overlaps. Solid pure MAGENTA #FF00FF background, no checkerboard or shadows/text/gridlines.

## scratchEnter

FOUR full-body transition frames in a single horizontal row, equal cells. This exact orange round short-legged cat facing LEFT as reference. Frame1 standing on all four paws looking up left; Frame2 rises onto hind paws with elbows bent; Frame3 raises front paws toward LEFT imaginary board; Frame4 matches reference pose paws touching vertical board on left. NO BOARD or tree rendered, CAT ONLY. Hind feet stay same ground position across cells, full tails. Preserve subtle flat wax-crayon felt material, small black eyes no highlights, tiny warm brown mouth, no white patches. Solid pure MAGENTA #FF00FF background, no checkerboard, no shadows/text/grid lines.

