
'use strict';

const _ = require('lodash');
const util = require('util');
const crypto = require('crypto');
const assert = require('assert');
const escapeStringRegexp = require('escape-string-regexp');

const FINGERPRINT_VALUE_IN_HEX_LENGTH = 40;
const FINGERPRINT_PLACEHOLDER = '%fingerprint%';

const MashState = {
    Unmashed: 'unmashed',
    BeginTagMissing: 'begin-tag-missing',
    EndTagMissing: 'end-tag-missing',
    SourceTextTampered: 'source-text-tampered',
    FingerprintInvalid: 'fingerprint-invalid',
    Mashed: 'mashed'
};

/**
 * Mashes a body of text into another unstructured text by inserts or updates (or reinserts)
 * The changes are done within the given tabs with integrity checks for previously inserted
 * blocks of text within the same tags.
 */
class UnstructuredTextMasher {

    /**
     * Mashes the given source text into the destination text.
     * The mashing may result in a merge of two texts (where source text)
     * is appended to the destination text, update of the previous version of source
     * text without any other change in the destination text or insertion of the
     * new version of the source text into the destination text if the previous source
     * text (including the tags and fingerprint) has been tampered with.
     *
     * @param {string} destinationText
     * @param {string} beginTag
     * @param {string} sourceText
     * @param {string} endTag
     * @return {string}
     */
    static mash(destinationText, beginTag, sourceText, endTag) {
        //  Get the current text mash info. We don't know the previous source text
        //  so we use undefined instead.
        const mashInfo = UnstructuredTextMasher._getMashInfo(
            destinationText, beginTag, undefined, endTag);

        switch (mashInfo.state) {
            case MashState.Unmashed:
                //  When there was no previous (detectable) mashing of the texts
                //  we append our source text to the end of the destination text.
                return UnstructuredTextMasher._appendText(
                    destinationText, beginTag, sourceText, endTag);
            case MashState.BeginTagMissing:
                //  When begin tag is missing we insert the text immediately after
                //  the end tag as we don't know where else we could insert it.
                //  We could append it but then we might end up with partial mash
                //  at the beginning and the new mash all the way at the bottom.
                return UnstructuredTextMasher._insertText(destinationText,
                    mashInfo.endOfEndTagIndex, beginTag, sourceText, endTag);
            case MashState.EndTagMissing:
            case MashState.FingerprintInvalid: {
                //  When end tag is missing or fingerprint is invalid we insert
                //  the new source text above the begin tag so that it's visible
                //  to the users before they even reach the corrupted mash.
                return UnstructuredTextMasher._insertText(destinationText,
                    mashInfo.beginTagIndex, beginTag, sourceText, endTag);
            }
            // istanbul ignore next
            case MashState.SourceTextTampered: {
                //  This should never happen because we don't know the previous
                //  source text so we cannot know if it or its fingerprint have
                //  been tampered with.
                assert(false);
                break;
            }
            default:
                break;
        }

        //  This must be true based on everything we know about the way the text mashing is done.
        assert.strictEqual(mashInfo.state, MashState.Mashed);
        assert(mashInfo.beginTagIndex !== -1);
        assert(mashInfo.endOfEndTagIndex !== -1);

        //  Get unmashed destination text by extracting all the text between the beginning
        //  of the begin tag and end of end tag.
        const unsycnedDestinationText =
            destinationText.substring(0, mashInfo.beginTagIndex) +
            destinationText.substring(mashInfo.endOfEndTagIndex);
        //  Insert the new source text where the old source text previously was.
        //  This way we don't interrupt any new text below the previously mashed
        //  source text.
        return UnstructuredTextMasher._insertText(
            unsycnedDestinationText, mashInfo.beginTagIndex, beginTag, sourceText, endTag);
    }

    /**
     * Returns true if the destination text contains a valid (complete and fingerprint matching)
     * source text between the tags.
     *
     * @param {string} destinationText
     * @param {string} beginText
     * @param {string} sourceText
     * @param {string} endText
     * @return {boolean}
     */
    static textIsMashed(destinationText, beginTag, sourceText, endTag) {
        return UnstructuredTextMasher._getMashInfo(destinationText, beginTag, sourceText, endTag).state
            === MashState.Mashed;
    }

    /**
     * Returns SHA1 hash of the given text as a hexadecimal string.
     *
     * @param {string} text
     * @param {string}
     *
     * @private
     */
    static _fingerprint(text) {
        return crypto.createHash('sha1').update(text).digest('hex');
    }

    /**
     * Appends the source text to the end of the destination text.
     * Wraps up the source text into begin and end tags and adds a fingeprint of it.
     *
     * @private
     */
    static _appendText(destinationText, beginTag, sourceText, endTag) {
        return UnstructuredTextMasher._insertText(
            destinationText, destinationText.length, beginTag, sourceText, endTag);
    }

    /**
     * Inserts the source text into the destination text at the insertion index.
     * Wraps up the source text into begin and end tags and adds a fingeprint of it.
     *
     * @private
     */
    static _insertText(destinationText, insertionIndex, beginTag, sourceText, endTag) {
        return destinationText.substring(0, insertionIndex) +
            beginTag +
            sourceText +
            endTag.replace(FINGERPRINT_PLACEHOLDER, UnstructuredTextMasher._fingerprint(sourceText)) +
            destinationText.substring(insertionIndex);
    }

    /**
     * Analyzes the destination text for previous text mashing and returns
     * the information about it. The performed analysis goes beyond the first begin/end
     * tags searching for the first valid mash block. Failing to find one the function
     * returns whatever mash info there is on the topmost level of analysis.
     *
     * @param {string} destinationText
     * @param {string} beginTag
     * @param {string} sourceText
     * @param {string} endTag
     * @return {object} A tuple of values describing the found mash block.
     *
     * @private
     */
    static _getMashInfo(destinationText, beginTag, sourceText, endTag) {
        //  Iterator generator function generating all occurrences of begin tag in the
        //  destination text.
        function *beginTagOccurrenceIterator() {
            var index = 0;
            while((index = destinationText.indexOf(beginTag, index)) !== -1) {
                yield {
                    index: index,
                    endIndex: index + beginTag.length
                };
                index += beginTag.length;
            }
        };

        //  Replace the fingerprint placeholder in end tag and make a regexp out of it.
        //  With that regexp we can iterate over end tag occurrencies without
        //  knowing the fingeprint's actual value.
        const endTagRegExp = new RegExp(
            escapeStringRegexp(endTag).replace(
                escapeStringRegexp(FINGERPRINT_PLACEHOLDER),
                util.format('([0-9a-fA-F]{%d})', FINGERPRINT_VALUE_IN_HEX_LENGTH)), 'm');
        //  Iterator generator function generating all occurrences of end tag in the
        //  destination text.
        function *endTagOccurrenceIterator(endOfBeginTagIndex) {
            var index = endOfBeginTagIndex;
            var match = null;
            while((match = endTagRegExp.exec(destinationText.substring(index))) !== null) {
                const endTagIndex = index + match.index;
                const endTagEndIndex = endTagIndex + match[0].length;
                yield {
                    index: endTagIndex,
                    endIndex: endTagEndIndex,
                    fingerprint: match[1]
                };
                index = endTagEndIndex;
            }
        };

        //  Helper function to create the info tuple we return to the caller.
        const createInfo = (state, beginTagOccurrence, endTagOccurrence) => {
            return {
                state: state,
                beginTagIndex: beginTagOccurrence && beginTagOccurrence.index,
                endOfBeginTagIndex: beginTagOccurrence && beginTagOccurrence.endIndex,
                endTagIndex: endTagOccurrence && endTagOccurrence.index,
                endOfEndTagIndex: endTagOccurrence && endTagOccurrence.endIndex
            };
        };

        //  We need first occurrencies of begin/end tags and of the first detected invalid state
        //  to correctly inform the caller of the properties of the first failed block.
        var firstBeginTagOccurrence;
        var firstEndTagOccurrence;
        var firstInvalidState = MashState.Unmashed;
        //  Iterate over occurrencies of begin and end tags, validating text within them
        //  and looking for the first valid (mashed) occurrence.
        for (var beginTagOccurrence of beginTagOccurrenceIterator()) {
            //  Grab the first begin tag occurrence.
            if (!firstBeginTagOccurrence) {
                firstBeginTagOccurrence = beginTagOccurrence;
            }

            for (var endTagOccurrence of endTagOccurrenceIterator(beginTagOccurrence.endIndex)) {
                //  Grab the first end tag occurrence.
                if (!firstEndTagOccurrence) {
                    firstEndTagOccurrence = endTagOccurrence;
                }

                //  Extract the source text between the begin and end tags.
                const potentialSourceText = destinationText.substring(
                    beginTagOccurrence.endIndex, endTagOccurrence.index);

                //  Check the potential source text for tampering.
                const sourceTextTampered = _.isString(sourceText) ?
                    (sourceText !== potentialSourceText) : false;
                const fingerprintInvalid = endTagOccurrence.fingerprint !==
                    UnstructuredTextMasher._fingerprint(potentialSourceText);
                if (firstInvalidState === MashState.Unmashed) {
                    //  Grab the first invalid state so that we can report it if we have to.
                    if (sourceTextTampered) {
                        firstInvalidState = MashState.SourceTextTampered;
                    } else if (fingerprintInvalid) {
                        firstInvalidState = MashState.FingerprintInvalid;
                    }
                }

                //  We found the first chunk of text that passes all our checks so we
                //  consider it mashed.
                if (!sourceTextTampered && !fingerprintInvalid) {
                    return createInfo(MashState.Mashed, beginTagOccurrence, endTagOccurrence);
                }
            }
        }

        //  If the begin/tag tags are incomplete then we either don't have anything to check
        //  or we cannot check validity as we don't know where to begin from.
        if (!firstBeginTagOccurrence) {
            //  The consequence of iterating over end tags only relatively to begin tags is
            //  that if there are no begin tags we will not detect any end tags (which we need
            //  to "nicely" insert new source text immediately after the first end tag if such
            //  exists). To fix this we manually search for the first occurrence of end tag
            //  starting from the beginning of the destination string (the "0" below)
            assert(!firstEndTagOccurrence);
            for (var endTagOccurrence of endTagOccurrenceIterator(0)) {
                firstEndTagOccurrence = endTagOccurrence;
                break;
            }

            //  If we still don't have first end tag occurrence then we don't have neither
            //  begin nor end tags so the text is treated as unmashed.
            if (!firstEndTagOccurrence) {
                return createInfo(MashState.Unmashed);
            }

            return createInfo(MashState.BeginTagMissing, undefined, firstEndTagOccurrence);
        } else {
            if (!firstEndTagOccurrence) {
                return createInfo(MashState.EndTagMissing, firstBeginTagOccurrence);
            }

            //  Use the first detected invalid state to report it to the caller.
            return createInfo(firstInvalidState, firstBeginTagOccurrence, firstEndTagOccurrence);
        }
    }
}

UnstructuredTextMasher.MashState = MashState;
UnstructuredTextMasher.FINGERPRINT_PLACEHOLDER = FINGERPRINT_PLACEHOLDER;
UnstructuredTextMasher.FINGERPRINT_VALUE_IN_HEX_LENGTH = FINGERPRINT_VALUE_IN_HEX_LENGTH;

module.exports = UnstructuredTextMasher;
