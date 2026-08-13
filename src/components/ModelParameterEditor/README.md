# ModelParameterEditor

`ModelParameterEditor` edits the model definition without owning a request or save API.
It merges all definitions from `definition.params.properties` and
`definition.testParams.properties` by their original `property` value. The two definition
lists control whether a parameter is available for real-time inference or image inference;
scene values are written independently to `setupTranscode` and `processImage`.
The `others` editor only updates `definition.others`, so `processVideo` and other unknown
definition fields remain unchanged.

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

Target cards and part cards can be collapsed independently. Target and part labels are edited
directly in their card headers. Capability rows show their name, path, and enabled state;
their model, vector profile, and additional JSON parameters open in a configuration modal.
Collapse state is local UI state and is never written into the model definition.
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
