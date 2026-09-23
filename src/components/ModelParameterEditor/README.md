# ModelParameterEditor

`ModelParameterEditor` edits the model definition without owning a request or save API.
It merges all definitions from `definition.params.properties` and
`definition.testParams.properties` by their original `property` value. The two definition
lists control whether a parameter is available for real-time inference or image inference;
scene values are written independently to `setupTranscode` and `processImage`.
The `others` editor only updates `definition.others`, so `processVideo` and other unknown
definition fields remain unchanged.

## Section Navigation

Presentation: retain the existing Ant Design Vue Tabs and all active-tab, validation,
draft, and save bindings. In `style.less`, group the 28px items in a compact, lightly
bordered neutral track with 4px inner spacing and a white active item. Remove the
navigation baseline and ink bar, and leave 12px before the section description/content.
Remove the editor's duplicate horizontal padding so the navigation track and content
share the enclosing `ModelConfig` title's left edge. The primary tabs keep their original
styling. Limit the track to the available width; tab overflow and keyboard navigation
remain owned by Ant Design Vue. No additional navigation component or data state is
introduced.

Verification: scoped LESS compilation and `git diff --check` passed. SHA-256 checks
confirmed `index.vue`, `modelParameterUtils.ts`, `targetInferenceUtils.ts`, and
`useSceneParameterDefaults.ts` are unchanged from before the navigation styling work.
This localized presentation change does not add tests or repeat full lint/typecheck/build;
browser rendering remains to be verified.

## ROI Form

Presentation: `locale.othersDescription` remains above the configuration groups.
`ParameterOthersPanel.vue` reuses `SectionCard` for one ROI drawing support group, with
three equal-width options and each switch immediately after its label. `style.less` wraps the
columns when the panel is narrow. Future major settings belong in sibling groups.
The locale keys, read-only state, events, and ROI data rules remain unchanged.
The parameter-definition tab is named 参数定义 / Parameter Definition, and its empty-state
guidance uses the same name. Shared defaults and the machine-vision host's existing
Chinese/English locale overrides must stay aligned. Only display strings are renamed.

Horizontal layout verification: Vue SFC script/template, LESS, and locale JSON checks
passed; the changed shared Chinese defaults match the host overrides and corresponding
English entries exist. The responsive grid declaration survives LESS processing.
Both affected repositories passed `git diff --check`.
The panel is 64 lines. This presentation-only change adds no business logic or unit
tests. No full lint/typecheck/build or browser session was run; rendered spacing and
wrapping remain to be checked on the model configuration page. The existing commands
below can be used when broader verification is needed.

- `ParameterOthersPanel.vue` displays one ROI drawing section with three switches:
  drawing areas (`area`), drawing lines (`line`), and an inside/outside divider
  (`entryExitLine`, Chinese label: 内外分界线).
- Keep the data at `definition.others`; do not introduce a nested ROI object.
  Only the boolean value `true` enables a switch. Enabling writes `true`; disabling
  removes the corresponding key. Preserve every unrelated `others` and definition field.
- Areas and lines can both be enabled. Enabling the inside/outside divider removes
  `area` and `line`; enabling either ordinary drawing capability removes `entryExitLine`.
  Turning a capability off does not restore previously enabled capabilities.
- Existing conflicting flags display the inside/outside divider as the active mode.
  Saving the form normalizes the three keys. Loading or viewing a model does not emit
  an update or persist a change.
- Keep the existing editing, save, and cancel flow. Disable the switches in read-only
  mode. The enclosing model definition JSON view and the ROI drawing canvas are out
  of scope.
- Implementation ownership is `runtime-ui/jetlinks-web-core/src/components/ModelParameterEditor`.
  `ParameterOthersPanel.vue` owns presentation; `index.vue` integrates the draft and save
  normalization. `modelParameterUtils.ts` centralizes ROI transitions and strict boolean
  echo. Existing `types.ts` / `defaultLocale.ts` own the locale contract. These changes
  reuse the existing component and utility files without adding another directory layer.
  `ModelConfig` uses this shared editor by default. Its current machine-vision caller,
  `runtime-ui/modules/jetlinks-ai-ui/views/machine-vision/Model/ModelConfig/index.vue`, only
  adds four locale mappings, backed by that module's `locales/lang/zh.json` and `en.json`.

Verification: targeted `vue-tsc` passed for the ROI panel, its imported helpers/types, and
default locale. SFC script/template syntax checks passed for both shared Vue files and the
machine-vision host; LESS and locale JSON parsing passed. In-memory execution confirmed
strict boolean echo, area/line coexistence, bidirectional mutual exclusion, disabled-key
removal, conflict normalization, unrelated-key preservation, and unchanged source objects.
Both affected repositories passed `git diff --check`. No unit test files were added or changed.
The shared Vue files remain below 300 lines; the existing 493-line host only adds locale
mappings and is intentionally not restructured in this change.

Browser interaction (read-only controls, save/cancel/reload) remains to be verified on the
model configuration page. No browser was opened, and no full lint/build was run for this
localized change. Re-run the targeted type check from `runtime-ui` with:

```sh
node node_modules/vue-tsc/bin/vue-tsc.js --noEmit --skipLibCheck --strict --module ESNext --moduleResolution Bundler --target ES2022 --lib ES2022,DOM --types ant-design-vue/typings/global jetlinks-web-core/src/components/ModelParameterEditor/ParameterOthersPanel.vue jetlinks-web-core/src/components/ModelParameterEditor/defaultLocale.ts
```

When a full build is needed, run
`pnpm --config.verify-deps-before-run=false -F jetlinks-web-core build -- --module-name jetlinks-ai-ui`
from `runtime-ui`.

## Parameter Editing

Real-time and image inference each provide a User Parameters / Default Parameters switch.
User Parameters keeps the structured value table. Default Parameters shows the scene
defaults after removing all paths declared by either `params.properties` or
`testParams.properties` as JSON; while editing, changes update only the non-configurable
part and preserve user parameter values. The default JSON intentionally omits the entire
`targetInference` tree; secondary inference is maintained in its dedicated tab.
The structured value table fills the remaining panel height and scrolls internally, so long
real-time or image parameter lists do not push the whole model configuration page.

While editing, the parameter table keeps row drafts locally so adding or checking a row
does not reorder or discard other drafts. It emits a non-destructive preview definition so
the real-time and image inference tabs can immediately display newly added parameters; save
time removal and value migration are still applied only when Save is clicked. The enclosing
`ModelConfig` validates every row at that point; invalid rows block the `save-config` event.
Rows are removed only through the explicit delete action.

In the secondary inference configuration modal, fields that become required when a capability
is enabled show a red asterisk beside their label, matching the save validation rules.

When validation fails, the editor activates the tab that owns the invalid content while
`ModelConfig` displays the shared save error message; future scene validators can reuse
the same tab activation path.

The Secondary Inference tab edits one shared target-inference definition by target label.
The validated value is written to `definition.setupTranscode.targetInference`,
`definition.processImage.targetInference`, and `definition.processVideo.targetInference` so
all execution scenes receive newly added targets and their default `enabled` values. The
target-inference tree is restored after the real-time and image default JSON is merged, so a
default JSON edit cannot accidentally remove it. Each target can configure vector extraction,
feature recognition, and one level of part detection; model values are stored as a
comma-separated file-name list in the corresponding nested `params.model_file` path. The
model selector only lists files under `models/targetInference`. Existing flattened `targetInference.*` values are
read from any of the three scenes for compatibility and normalized to the nested shape on save.

### Secondary Inference Presentation

Approved layout: one target card with compact capability rows and borderless part
sections. Target/part label editing, independent collapse controls, add/remove actions,
and the configuration modal are retained. Default-enabled and user-selectable states
are displayed separately, reading the existing draft booleans directly. The existing
model string is truncated with a tooltip; full technical paths remain inside the modal.
Row actions use icon-only buttons with localized tooltips and accessible names: view
configuration uses an eye, configure uses a gear, add-part uses a plus, and delete uses
a trash icon. Add Target keeps its plus icon and text in a full-width dashed button.
When editing an empty target list, show this add entry without a redundant empty-state
illustration; read-only empty lists retain the existing empty state.

Part sections use a clear heading and compact part-label tags instead of a full-width
gray strip. The localized model summary label includes its colon. Selectable-parameter
labels read 用户可选·参数名称 / 用户可选·参数说明. The modal retains its path subtitle,
stacks sections naturally, gives model selection a full row, bounds the JSON editor
height, and scrolls when viewport height is limited. Model-token wrapping and improved
disabled-control contrast are scoped to this modal. The unused disabled search suffix
is hidden to avoid an empty extra line; editing keeps its original search input.
`ParameterField.vue` and all field bindings and update handlers remain unchanged.

Ownership: `TargetInferenceGroup.vue` and `targetInferenceGroup.less` own the outer card
and part section heading; `TargetInferencePart.vue` owns the light part header;
`TargetInferenceEditor.vue` owns the full-width add entry and read-only empty state;
`TargetInferenceOperation.vue` owns capability summaries and the existing modal entry;
`TargetInferenceOperationBody.vue` and `targetInferenceOperationBody.less` own the modal
presentation while retaining the original controls and update handlers.
Locale additions belong to `types.ts`, `defaultLocale.ts`, and the machine-vision host's
existing locale mappings and Chinese/English resources.

Keep `targetInferenceUtils.ts`, `targetInferenceValidation.ts`, and all
draft/update/save/echo logic unchanged. `TargetInferenceEditor.vue` and
`TargetInferenceOperationBody.vue` may receive presentation changes only; preserve their
scripts and data-event bindings along with the other presentation components.
No new requests, fallback fields, persistence state, business rules, or test files.

Reuse review: checked the current feature, machine-vision caller, shared exports,
`SectionCard`, `MetaChip`, and Ant Design primitives. Reuse the existing capability
component, tags, tooltip, buttons, and modal. Keep the existing target shell because it
owns collapsible headers with editable labels and validation; `SectionCard` has no
equivalent collapse/header-input contract. Apply the shared spacing/border/radius tokens
without changing that shared component. The existing directory has 25 implementation
files; this task adds none and preserves its public entry and internal dependencies.
The large host file receives only locale mappings, avoiding unrelated restructuring.

Verification: Vue SFC script/template and LESS checks passed for the presentation
components (Editor: 272 lines; Group: 224 lines; Part: 260 lines; Operation: 254 lines;
Body: 224 lines, unchanged in the icon-button adjustment). Host script and
Chinese/English locale parsing and mapping checks passed. Both repositories passed
`git diff --check`. SHA-256 comparison confirmed five data-related files and all five
presentation scripts are unchanged from the pre-icon-adjustment baseline. Template AST
comparison confirmed all event and model bindings are unchanged. Field/child data props
were verified during modal polishing. Modal sizing and editing-empty-state visibility
are presentation changes. No unit test files were added or modified.
The 497-line host only adds locale mappings.

No full lint/typecheck/build or browser session was run for this presentation change.
Rendered spacing, long names, collapse/edit controls, and save/cancel/reload remain to be
verified on the model configuration page. When broader verification is needed, run
`node node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p jetlinks-web-core/tsconfig.json`
from `runtime-ui`; the full build command is recorded above.

Target and part sections can be collapsed independently. Target and part labels are edited
directly in their headers. Model, vector profile, and additional JSON parameters continue
to open in the existing configuration modal. Collapse state is local UI state and is
never written into the model definition.
Long target-inference group lists also fill the remaining tab height and scroll internally,
matching the real-time and image parameter tabs.

`ModelConfig` uses it as the default editor on the model parameters tab, so existing
`ModelConfig` callers do not need to add a slot or register the component:

```vue
<ModelConfig :model="model" />
```

Use the `definition-content` slot only when a business module needs to replace the default editor:

```vue
<ModelConfig :model="model">
  <template #definition-content="{ definition, editing, files, updateDefinition }">
    <ModelParameterEditor
      :definition="definition"
      :editing="editing"
      :files="files"
      @update:definition="updateDefinition"
    />
  </template>
</ModelConfig>
```

The host keeps the existing `save-config` handler. Pass `locale` when the host does not
use the component's default Chinese labels.
