# ModelParameterEditor

`ModelParameterEditor` edits the model definition without owning a request or save API.
It merges all definitions from `definition.params.properties` and
`definition.testParams.properties` by their original `property` value. The two definition
lists control whether a parameter is available for real-time inference or image inference;
scene values are written independently to `setupTranscode` and `processImage`.
The `others` editor only updates `definition.others`, so `processVideo` and other unknown
definition fields remain unchanged.

## Section Navigation

Use the device data page's Ant Design Vue `Segmented` for section navigation, retaining
the original tab keys and all validation, draft, and save bindings. Labels use the same
minimum width, bold weight and active primary color as the device control. The toolbar
keeps the optional sibling `actions` slot, adds the device toolbar's bottom divider and
spacing, and wraps actions when space is limited. The segmented control scrolls within
its available width; the body still fills and scrolls within the remaining height.
The editor stays transparent so the enclosing `ContentPanel` owns the background.

Parameter definitions use the same `a-table` with `size="small"` as the gateway firmware
task panel. Keep pagination off, use the existing stable `rowId` as the row key, and
retain the current input/select/checkbox events, read-only state and error indicators.
The existing row drafts, preview, `prepareForSave()` and empty state are unchanged.
No requests, sorting, filters, fallback fields or tests are added. Both core checkouts
receive this presentation update, including callers without an actions slot.

Ownership: `index.vue` / `style.less` own navigation and separation;
`ParameterConfigTable.vue` / `parameterConfigTable.less` own table presentation.
The table has no sorting or pagination, so its cell index reads the same ordered draft
array supplied as its data source; the stable row key stays independent of path edits.

Verification: targeted `vue-tsc --noEmit` in both workspaces, SFC/script/template/LESS
compilation, the existing `check:ui-style` gate and `git diff --check` passed. Script
comparison found only localized navigation options and table columns added; all draft,
validation, preview and save functions remain unchanged. Parameter input/select/checkbox
event bindings match the previous template. The Vue entries are 297 and 285 lines.
In the running frontend, both 869px and 1935px client widths were verified: narrow
actions wrap, wide actions stay beside navigation, and horizontal table overflow stays
inside the content. The device/model table headers share their background, 14px size,
600 weight, 8px padding and divider; the toolbar uses the device's 12px bottom padding
and 16px content gap. All five sections and model files switch normally. Local add,
delete, path edit and applicability changes preview correctly across inference sections;
exiting edit restores the original 23 rows and read-only controls. Model testing retains
its disabled state. No server save, new unit tests or full production build was run.
The operator caller's browser flow remains unverified; its scoped type checks passed,
and its existing full-build dependency blocker is recorded in `../ModelConfig/README.md`.

## Unsaved Changes On Primary Tab Switch

Approved scope: only `ModelConfig` primary tabs guard unsaved changes. All five
parameter sections continue to share one definition draft and switch freely, without
prompts or validation on navigation. Save validation still selects its owning section
and scene mode directly.

Expose a side-effect-free `hasChanges()` query for local parameter row drafts,
target-inference drafts and invalid scene-default JSON, including edits that do not
change the serialized preview. The default editor compares parameter definitions through
their row drafts and other definition fields against the edit-start snapshot. It does
not treat fields automatically rebuilt by parameter previews as user changes, so
restoring an edited value does not cause a false prompt. JSON, custom slots and file
editors retain their own edit-start comparison. Dirty observation never runs validation
or applies save-time normalization; tab/mode/collapse UI state does not make the configuration dirty.
Existing edit cancellation resets child drafts through their current editing watchers.

Reuse the existing components and hooks; this change adds no parameter-editor files
or new directory level. Keep the public entry, standalone behavior, validators and
serialized business fields unchanged, and the Vue entries within 300 lines. The
workspace owns the dialog's 保存 / 丢弃 / 取消 actions, actual save result and primary
target switch; see `../ModelConfig/README.md`. Both core checkouts have matching
implementations. Scoped type checks, SFC/template/LESS checks and the existing UI style
gate passed; changed Vue files remain within 300 lines. Runtime browser checks covered
free secondary navigation, draft preservation, cancel/discard, unchanged/restored values,
blank parameter rows, incomplete target groups and invalid default JSON. Validation
returned to the owning section and default mode without applying the pending primary
switch. No new unit tests or business API changes. Real save requests and the operator
browser flow were not exercised; the original host completion callbacks were reviewed.

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
illustration; read-only empty lists retain the existing empty state. Center `CloudEmpty`
in the remaining content height below the introduction, using its existing `style` prop.
The Chinese guidance reads 暂无二次推理配置，点击编辑新增; shared defaults and the
machine-vision host's Chinese/English/Japanese locale overrides stay aligned. This
presentation update preserves all draft, validation and save bindings.

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
