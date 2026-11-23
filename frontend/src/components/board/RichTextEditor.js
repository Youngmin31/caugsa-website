/**
 * RichTextEditor
 * ==============
 * 게시글 본문 편집기.
 *
 * 본문은 DB 에 HTML 로 저장되고 상세 화면에서 그대로 그려진다
 * (BoardDetailPage 의 dangerouslySetInnerHTML). 그래서 편집도 HTML 을
 * 직접 다루는 contentEditable 로 한다 — 넣은 이미지가 <img ...> 글자가 아니라
 * 실제 그림으로 보이고, 링크도 눌러지는 모양 그대로 보인다.
 *
 * 서식 명령은 document.execCommand 를 쓴다. 표준에서는 폐기 예정이지만
 * 모든 브라우저가 아직 지원하고, 이 정도 기능에 편집기 라이브러리를
 * 새로 들이는 것보다 가볍다.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";

import { colors, font, radius, clampW, clampH } from "../../styles/theme";

const Wrapper = styled.div`
    border: 1px solid ${colors.border};
    border-radius: ${radius.md};
    background: ${colors.white};
    overflow: hidden;

    &:focus-within {
        border-color: ${colors.navy};
    }
`;

const Toolbar = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${clampW(6)};
    padding: ${clampH(8)} ${clampW(10)};
    border-bottom: 1px solid ${colors.divider};
    background: ${colors.pageBg};
`;

const ToolButton = styled.button`
    width: fit-content;
    padding: ${clampH(7)} ${clampW(12)};
    border: 1px solid ${colors.border};
    border-radius: ${radius.sm};
    background: ${colors.white};
    color: ${colors.text};
    font-family: ${font.family};
    font-size: ${font.size.sm};
    font-weight: ${font.weight.medium};
    line-height: 1.2;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;

    &:hover:not(:disabled) {
        border-color: ${colors.navy};
        color: ${colors.navy};
    }

    &:disabled {
        opacity: 0.5;
        cursor: default;
    }
`;

const Divider = styled.span`
    width: 1px;
    height: 18px;
    background: ${colors.border};
    margin: 0 2px;
`;

const Hint = styled.span`
    margin-left: auto;
    font-family: ${font.family};
    font-size: ${font.size.xs};
    color: ${colors.textLight};
`;

const Area = styled.div`
    min-height: ${(props) => clampH(props.$minHeight)};
    max-height: ${clampH(640)};
    overflow-y: auto;
    padding: ${clampW(18)};
    font-family: ${font.family};
    font-size: ${font.size.md};
    color: ${colors.text};
    line-height: 1.75;
    outline: none;
    word-break: break-word;

    /* 넣은 이미지는 편집 중에도 실제 크기로 보인다 */
    img {
        max-width: 100%;
        height: auto;
        display: block;
        margin: 10px 0;
        border-radius: ${radius.sm};
    }

    a {
        color: ${colors.blue};
        text-decoration: underline;
    }

    /* 전역 리셋이 b/strong 의 굵기와 목록의 점을 지워 버린다.
       본문 안에서는 되살려야 관리자가 넣은 서식이 그대로 보인다. */
    b,
    strong {
        font-weight: ${font.weight.bold};
    }

    ul,
    ol {
        margin: 10px 0;
        padding-left: 22px;
        list-style: revert;
    }

    li {
        list-style: inherit;
    }

    /* 비어 있을 때 안내 문구 */
    &:empty::before {
        content: attr(data-placeholder);
        color: ${colors.textLight};
    }
`;

const ImageIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.2" y="5" width="17.6" height="14" rx="2.2" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="8.8" cy="10" r="1.6" stroke="currentColor" strokeWidth="1.4" />
        <path d="M4 16.6l4.6-4.2 3.6 3.2 3-2.6 4.2 3.6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
);

const LinkIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M10.4 13.6a3.6 3.6 0 0 0 5.1 0l2.9-2.9a3.6 3.6 0 0 0-5.1-5.1l-1.3 1.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M13.6 10.4a3.6 3.6 0 0 0-5.1 0l-2.9 2.9a3.6 3.6 0 0 0 5.1 5.1l1.3-1.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
);

/** 앞에 http 가 없으면 붙여 준다. (mailto: 같은 건 그대로 둔다) */
const normalizeUrl = (raw) => {
    const url = raw.trim();
    if (!url) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("/")) return url;
    return `https://${url}`;
};

const RichTextEditor = ({
    value,
    onChange,
    onUploadImage,
    placeholder = "내용을 입력하세요",
    minHeight = 300,
}) => {
    const areaRef = useRef(null);
    const fileRef = useRef(null);
    const rangeRef = useRef(null);
    const [uploading, setUploading] = useState(false);

    // 바깥에서 들어온 값(수정 모드의 기존 본문)만 반영한다.
    // 타이핑할 때마다 innerHTML 을 다시 넣으면 커서가 맨 앞으로 튄다.
    useEffect(() => {
        const el = areaRef.current;
        if (el && value !== el.innerHTML) {
            el.innerHTML = value || "";
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value === undefined]);

    /** 툴바를 누르면 편집 영역이 포커스를 잃으므로 커서 위치를 미리 저장해 둔다 */
    const rememberCaret = useCallback(() => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        if (areaRef.current && areaRef.current.contains(range.commonAncestorContainer)) {
            rangeRef.current = range.cloneRange();
        }
    }, []);

    /** 저장해 둔 커서 위치로 돌아간다. 없으면 맨 뒤. */
    const restoreCaret = useCallback(() => {
        const el = areaRef.current;
        if (!el) return;
        el.focus();
        const selection = window.getSelection();
        if (!selection) return;
        selection.removeAllRanges();
        if (rangeRef.current) {
            selection.addRange(rangeRef.current);
        } else {
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            selection.addRange(range);
        }
    }, []);

    const emitChange = useCallback(() => {
        if (areaRef.current) onChange(areaRef.current.innerHTML);
    }, [onChange]);

    const insertHtml = useCallback(
        (html) => {
            restoreCaret();
            document.execCommand("insertHTML", false, html);
            rangeRef.current = null;
            emitChange();
        },
        [emitChange, restoreCaret]
    );

    const handleImagePick = async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = "";
        if (!file) return;

        setUploading(true);
        try {
            const { url, originalName } = await onUploadImage(file);
            const alt = (originalName || "").replace(/"/g, "&quot;");
            insertHtml(`<img src="${url}" alt="${alt}" /><p><br /></p>`);
        } catch (err) {
            alert(err.message || "이미지를 올리지 못했습니다.");
        } finally {
            setUploading(false);
        }
    };

    const handleAddLink = () => {
        rememberCaret();
        const selection = window.getSelection();
        const selected = selection ? selection.toString() : "";

        const raw = window.prompt("연결할 주소를 입력하세요", "https://");
        if (raw === null) return;
        const url = normalizeUrl(raw);
        if (!url) return;

        if (selected) {
            // 고른 글자에 링크를 건다
            restoreCaret();
            document.execCommand("createLink", false, url);
            emitChange();
        } else {
            const text = window.prompt("링크에 보일 글자를 입력하세요", url);
            if (text === null) return;
            const safe = (text || url).replace(/</g, "&lt;").replace(/>/g, "&gt;");
            insertHtml(`<a href="${url}" target="_blank" rel="noreferrer noopener">${safe}</a>&nbsp;`);
        }
    };

    return (
        <Wrapper>
            <Toolbar>
                <ToolButton
                    type="button"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        rememberCaret();
                    }}
                    onClick={() => fileRef.current && fileRef.current.click()}
                    disabled={uploading}
                >
                    <ImageIcon />
                    {uploading ? "올리는 중…" : "이미지"}
                </ToolButton>

                <ToolButton
                    type="button"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        rememberCaret();
                    }}
                    onClick={handleAddLink}
                >
                    <LinkIcon />
                    링크
                </ToolButton>

                <Divider aria-hidden="true" />

                <ToolButton
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                        restoreCaret();
                        document.execCommand("bold");
                        emitChange();
                    }}
                >
                    <b>굵게</b>
                </ToolButton>

                <ToolButton
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                        restoreCaret();
                        document.execCommand("insertUnorderedList");
                        emitChange();
                    }}
                >
                    목록
                </ToolButton>

                <Hint>이미지는 본문에 바로 들어갑니다</Hint>

                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImagePick}
                    style={{ display: "none" }}
                />
            </Toolbar>

            <Area
                ref={areaRef}
                $minHeight={minHeight}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label="본문"
                data-placeholder={placeholder}
                onInput={emitChange}
                onBlur={() => {
                    rememberCaret();
                    emitChange();
                }}
                onKeyUp={rememberCaret}
                onMouseUp={rememberCaret}
            />
        </Wrapper>
    );
};

export default RichTextEditor;
