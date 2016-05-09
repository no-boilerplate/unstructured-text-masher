
'use strict';

const _ = require('lodash');
const assert = require('assert');
const UnstructuredTextMasher = require('../lib/unstructured-text-masher');

describe('UnstructuredTextMasher', function() {
    assert(UnstructuredTextMasher.FINGERPRINT_PLACEHOLDER);

    const DESTINATION_TEXT = 'This is a placeholder so that we can test insertions/updates.';
    const SOURCE_TEXT = 'Text to be inserted/updated.';
    const SOURCE_TEXT_2 = 'Updated inserted text.';
    const TAMPERED_SOURCE_TEXT = 'Tampered text.';
    const BEGIN_TAG =
        '\n\r<masher>\n\r\n\r';
    const END_TAG =
        '\n\r\n\r</masher (%fingerprint%)>\n\r';

    const assertTextIsClean = (text) => {
        assert(text.indexOf(BEGIN_TAG) === -1);
        assert(text.indexOf(SOURCE_TEXT) === -1);
        assert(text.indexOf(SOURCE_TEXT_2) === -1);
        assert(text.indexOf(END_TAG) === -1);
    };

    assertTextIsClean(DESTINATION_TEXT);

    const textIsMashed = (text, updatedText) => {
        return UnstructuredTextMasher.textIsMashed(text, BEGIN_TAG, updatedText, END_TAG);
    };

    describe('mash', function() {
        it('appends text when there is nothing to replace', function() {
            const mashedText = UnstructuredTextMasher.mash(
                DESTINATION_TEXT, BEGIN_TAG, SOURCE_TEXT, END_TAG);
            assert(textIsMashed(mashedText, SOURCE_TEXT));
        });

        it('updates text when text can be mashed', function() {
            const mashedText = UnstructuredTextMasher.mash(
                DESTINATION_TEXT, BEGIN_TAG, SOURCE_TEXT, END_TAG);
            assert(textIsMashed(mashedText, SOURCE_TEXT));
            const updatedText = UnstructuredTextMasher.mash(
                mashedText, BEGIN_TAG, SOURCE_TEXT_2, END_TAG);
            assert(!textIsMashed(updatedText, SOURCE_TEXT));
            assert(textIsMashed(updatedText, SOURCE_TEXT_2));
        });

        it('inserts text when begin tag has been tampered with', function() {
            var mashedText = UnstructuredTextMasher.mash(
                DESTINATION_TEXT, BEGIN_TAG, SOURCE_TEXT, END_TAG);
            assert(textIsMashed(mashedText, SOURCE_TEXT));
            mashedText = mashedText.replace(BEGIN_TAG, TAMPERED_SOURCE_TEXT);
            assert(!textIsMashed(mashedText, SOURCE_TEXT));
            const NEW_END_OF_DESTINATION_TEXT = 'This is a later addition to the text.';
            mashedText += NEW_END_OF_DESTINATION_TEXT;
            const updatedText = UnstructuredTextMasher.mash(
                mashedText, BEGIN_TAG, SOURCE_TEXT_2, END_TAG);
            assert(!textIsMashed(updatedText, SOURCE_TEXT));
            assert(textIsMashed(updatedText, SOURCE_TEXT_2));
            assert(updatedText.indexOf(TAMPERED_SOURCE_TEXT) < updatedText.indexOf(SOURCE_TEXT_2));
            //  Insertion happens before the end of the text so it's not an append.
            assert(updatedText.indexOf(SOURCE_TEXT_2) <
                updatedText.indexOf(NEW_END_OF_DESTINATION_TEXT));
            const SOURCE_TEXT_3 = 'A new different better text.';
            const finallyUpdatedText = UnstructuredTextMasher.mash(
                updatedText, BEGIN_TAG, SOURCE_TEXT_3, END_TAG);
            assert(!textIsMashed(finallyUpdatedText, SOURCE_TEXT));
            assert(!textIsMashed(finallyUpdatedText, SOURCE_TEXT_2));
            assert(textIsMashed(finallyUpdatedText, SOURCE_TEXT_3));
        });

        it('manages to find untampered mash even when previous mashes were tampered with', function() {
            var mashedText = UnstructuredTextMasher.mash(
                DESTINATION_TEXT, BEGIN_TAG, SOURCE_TEXT, END_TAG);
            assert(textIsMashed(mashedText, SOURCE_TEXT));
            mashedText = mashedText.replace(BEGIN_TAG, TAMPERED_SOURCE_TEXT);
            assert(!textIsMashed(mashedText, SOURCE_TEXT));
            const updatedText = UnstructuredTextMasher.mash(
                mashedText, BEGIN_TAG, SOURCE_TEXT_2, END_TAG);
            assert(!textIsMashed(updatedText, SOURCE_TEXT));
            assert(textIsMashed(updatedText, SOURCE_TEXT_2));
            assert(updatedText.indexOf(TAMPERED_SOURCE_TEXT) < updatedText.indexOf(SOURCE_TEXT_2));
            const updatedUpdatedText = BEGIN_TAG + updatedText;
            assert(textIsMashed(updatedUpdatedText, SOURCE_TEXT_2));
            const SOURCE_TEXT_3 = 'A new different better text.';
            const finallyUpdatedText = UnstructuredTextMasher.mash(
                updatedText, BEGIN_TAG, SOURCE_TEXT_3, END_TAG);
            assert(!textIsMashed(finallyUpdatedText, SOURCE_TEXT));
            assert(!textIsMashed(finallyUpdatedText, SOURCE_TEXT_2));
            assert(textIsMashed(finallyUpdatedText, SOURCE_TEXT_3));
        });

        it('inserts text when end tag has been tampered with', function() {
            var mashedText = UnstructuredTextMasher.mash(
                DESTINATION_TEXT, BEGIN_TAG, SOURCE_TEXT, END_TAG);
            assert(textIsMashed(mashedText, SOURCE_TEXT));
            mashedText = mashedText.replace(END_TAG.substring(0, 5), TAMPERED_SOURCE_TEXT);
            const info = UnstructuredTextMasher._getMashInfo(mashedText, BEGIN_TAG, SOURCE_TEXT, END_TAG);
            assert(info.state === UnstructuredTextMasher.MashState.EndTagMissing);
            assert(!textIsMashed(mashedText, SOURCE_TEXT));
            const updatedText = UnstructuredTextMasher.mash(
                mashedText, BEGIN_TAG, SOURCE_TEXT_2, END_TAG);
            assert(!textIsMashed(updatedText, SOURCE_TEXT));
            assert(textIsMashed(updatedText, SOURCE_TEXT_2));
            assert(updatedText.indexOf(TAMPERED_SOURCE_TEXT) > updatedText.indexOf(BEGIN_TAG));
            assert(updatedText.indexOf(TAMPERED_SOURCE_TEXT) > updatedText.indexOf(SOURCE_TEXT_2));
        });

        it('inserts text when mashed blocked has been tampered with', function() {
            var mashedText = UnstructuredTextMasher.mash(
                DESTINATION_TEXT, BEGIN_TAG, SOURCE_TEXT, END_TAG);
            assert(textIsMashed(mashedText, SOURCE_TEXT));
            mashedText = mashedText.replace(SOURCE_TEXT, TAMPERED_SOURCE_TEXT);
            assert(!textIsMashed(mashedText, SOURCE_TEXT));
            const updatedText = UnstructuredTextMasher.mash(
                mashedText, BEGIN_TAG, SOURCE_TEXT_2, END_TAG);
            assert(!textIsMashed(updatedText, SOURCE_TEXT));
            assert(textIsMashed(updatedText, SOURCE_TEXT_2));
            assert(updatedText.indexOf(SOURCE_TEXT_2) < updatedText.indexOf(TAMPERED_SOURCE_TEXT));
        });

        it('correctly handles begin and end tags in destination text', function() {
            const mashedText = UnstructuredTextMasher.mash(
                BEGIN_TAG + DESTINATION_TEXT + END_TAG, BEGIN_TAG, SOURCE_TEXT, END_TAG);
            assert(textIsMashed(mashedText, SOURCE_TEXT));
        });

        it('correctly handles invalid begin/end tags in source text', function() {
            const sourceText = BEGIN_TAG + SOURCE_TEXT +
                END_TAG.replace(
                    UnstructuredTextMasher.FINGERPRINT_PLACEHOLDER,
                    '0'.repeat(UnstructuredTextMasher.FINGERPRINT_VALUE_IN_HEX_LENGTH));
            const mashedText = UnstructuredTextMasher.mash(
                DESTINATION_TEXT, BEGIN_TAG, sourceText, END_TAG);
            assert(textIsMashed(mashedText, sourceText));
        });

        it('correctly handles valid begin/end tags in source text', function() {
            const mashedText1 = UnstructuredTextMasher.mash(
                '', BEGIN_TAG, SOURCE_TEXT, END_TAG);
            assert(textIsMashed(mashedText1, SOURCE_TEXT));
            const mashedText2 = UnstructuredTextMasher.mash(
                DESTINATION_TEXT, BEGIN_TAG, mashedText1, END_TAG);
            assert(textIsMashed(mashedText2, mashedText1));
            const NEW_SOURCE_TEXT = 'Test again.';
            const mashedText3 = UnstructuredTextMasher.mash(
                mashedText2, BEGIN_TAG, NEW_SOURCE_TEXT, END_TAG);
            assert(textIsMashed(mashedText3, NEW_SOURCE_TEXT));
        });
    });
});
