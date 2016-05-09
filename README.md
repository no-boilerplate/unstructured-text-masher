# unstructured-text-masher

Mashes an unstructured texst into another unstructured text allowing for subsequent mashing updates

## Example

```js
var mashedText = UnstructuredTextMasher.mash(
    'Unstructured text.',
    '<begin>',
    'Some generated text which may change in the future.',
    '<end (%fingerprint%)>');
console.log(mashedText);
```

outputs:

```text
Unstructured text.<begin>Some generated text which may change in the future.<end (104f1998a99b8f46f037cf1200d03622b337e5fd)>
```

Then update the mashed text:

```js
mashedText = UnstructuredTextMasher.mash(
    mashedText,
    '<begin>',
    'Updated generated text.',
    '<end (%fingerprint%)>');
console.log(mashedText);
```

outputs:

```text
Unstructured text.<begin>Updated generated text.<end (6d7dffe0035f820feac7c71ca35eac0357f69670)>
```

Then insert more unstructured text and update the mashed text:

```js
mashedText = 'Inserted unstructured text. ' + mashedText;
mashedText = UnstructuredTextMasher.mash(
    mashedText,
    '<begin>',
    'Updated generated text number 2.',
    '<end (%fingerprint%)>');
console.log(mashedText);
```

outputs:

```text
Inserted unstructured text. Unstructured text.<begin>Updated generated text number 2.<end (5678d14cbdc1417992dfe18feabf0d6afc3a1f5f)>
```

Then append more unstructured text and update yet again the mashed text.

```js
mashedText += ' Appended unstructured text.';
mashedText = UnstructuredTextMasher.mash(
    mashedText,
    '<begin>',
    'Updated generated text number 3.',
    '<end (%fingerprint%)>');
console.log(mashedText);
```

outputs:

```text
Inserted unstructured text. Unstructured text.<begin>Updated generated text number 3.<end (7b33691ad5e7260abde676bf081551214be62616)> Appended unstructured text.
```
