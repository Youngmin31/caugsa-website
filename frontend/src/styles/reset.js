import { css } from "@emotion/react";
import PlusJakartaSansRegular from "../assets/fonts/PlusJakartaSans-Regular.ttf";   
import PlusJakartaSansMedium from "../assets/fonts/PlusJakartaSans-Medium.ttf";  
import PlusJakartaSansSemiBold from "../assets/fonts/PlusJakartaSans-SemiBold.ttf"; 
import PlusJakartaSansExtraBold from "../assets/fonts/PlusJakartaSans-ExtraBold.ttf";   

export const reset = css`
    html,
    body {
        min-width: 390px;
    }
    div,
    span,
    applet,
    object,
    iframe,
    h1,
    h2,
    h3,
    h4,
    h5,
    h6,
    p,
    blockquote,
    pre,
    a,
    abbr,
    acronym,
    address,
    big,
    cite,
    code,
    del,
    dfn,
    em,
    img,
    ins,
    kbd,
    q,
    s,
    samp,
    small,
    strike,
    strong,
    sub,
    sup,
    tt,
    var,
    b,
    u,
    i,
    center,
    dl,
    dt,
    dd,
    ol,
    ul,
    li,
    fieldset,
    form,
    label,
    legend,
    table,
    caption,
    tbody,
    tfoot,
    thead,
    tr,
    th,
    td,
    article,
    aside,
    canvas,
    details,
    embed,
    figure,
    figcaption,
    footer,
    header,
    hgroup,
    menu,
    nav,
    output,
    ruby,
    section,
    summary,
    time,
    mark,
    audio,
    video {
        margin: 0;
        padding: 0;
        border: 0;
        font-size: 100%;
        font: inherit;
        vertical-align: baseline;
        box-sizing: border-box;
    }
    article,
    aside,
    details,
    figcaption,
    figure,
    footer,
    header,
    hgroup,
    menu,
    nav,
    section {
        display: block;
    }
    ol,
    ul {
        list-style: none;
    }
    blockquote,
    q {
        quotes: none;
    }
    blockquote:before,
    blockquote:after {
        content: "";
        content: none;
    }
    q:before,
    q:after {
        content: "";
        content: none;
    }
    table {
        border-collapse: collapse;
        border-spacing: 0;
    }
    a {
        text-decoration: none;
        color: inherit;
    }

    html,
    body {
        height: 100%;
    }
    body {
        width: 100%;
        overflow-x: hidden;
        line-height: 1;
        font-family: "Pretendard", "NotoSansKR", sans-serif;
        margin: 0;
        /* 한글은 기본값(word-break: normal)에서 단어 중간(음절 사이)에서도
           줄바꿈될 수 있다. keep-all 로 단어 단위까지만 줄바꿈하고, 공백 없는
           긴 문자열(이메일·URL 등)이 넘칠 때만 overflow-wrap 이 잘라 준다. */
        word-break: keep-all;
        overflow-wrap: break-word;
    }

    ::-webkit-scrollbar {
        width: 10px;
        height: 10px;
    }
    ::-webkit-scrollbar-track {
        background-color: transparent;
        border-radius: 10px;
    }
    ::-webkit-scrollbar-thumb {
        background-color: #d8d8d8;
        border-radius: 10px;
        background-clip: padding-box;
        border: 3px solid transparent;
    }

    .fixed {
        overflow: hidden;
    }
    /* .fixed #wrap{position:fixed;width:100%;overflow:hidden} */
    .dim {
        position: fixed;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 500;
        display: none;
    }
    .fixed .dim {
        display: block;
    }
    .mq_xl {
    }
    .mq_lg,
    .mq_md,
    .mq_sm,
    .mq_xs {
        display: none !important;
    }

    /* Forms Style */
    input,
    button,
    .select,
    textarea {
        font-size: inherit;
        color: inherit;
    }
    /* 위 리셋의 요소 목록(Meyer reset)에는 main, fieldset, 폼 요소 등이 빠져 있다.
       그대로 두면 width: 100% 에 좌우 패딩이 더해져 화면 밖으로 삐져나가고,
       창을 줄일 때마다 가로 스크롤이 생긴다. 전부 border-box 로 통일한다. */
    *,
    *::before,
    *::after {
        box-sizing: border-box;
    }
    /* 예전에는 여기서 [type=text] / [type=password] / select 에
       height: 40px; padding: 0 0.6rem 을 걸었다. 속성·타입 선택자라
       styled-components 클래스와 우선순위가 같아서, 각 화면이 지정한
       높이와 여백을 덮어써 글자가 잘리는 문제가 있었다.
       크기는 각 화면이 정하도록 두고 여기서는 걷어냈다. */
    [type="text"],
    [type="password"],
    select,
    textarea,
    button {
        width: 100%;
        border: solid 1px #7b868c;
        background: #fff;
        font-size: 14px;
        color: #3d3e41;
    }

    @media all and (max-width: 1340px) {
        .inner {
            width: 100%;
        }
    }

    /* 예전에는 좁은 화면에서 body 를 가로로 스크롤시켰다(고정폭 시절).
       지금은 box-sizing 을 전역으로 맞춰 넘치는 원인 자체를 없앴으므로
       그 규칙을 두지 않는다. html 에 overflow-x 를 걸면 html 이 스크롤
       컨테이너가 되어 fixed/sticky 동작이 틀어지므로 일부러 비워 둔다.
       가로로 긴 표나 그림은 각자 컨테이너에서 overflow-x 를 갖는다. */

    @media screen and (max-width: 1024px) {
        .mq_xl {
            display: none !important;
        }
        .mq_lg {
            display: block !important;
        }
    }
    @media screen and (max-width: 960px) {
        .mq_lg {
            display: none !important;
        }
        .mq_md {
            display: block !important;
        }
    }
    @media screen and (max-width: 720px) {
        .mq_md {
            display: none !important;
        }
        .mq_sm {
            display: block !important;
        }
    }
    @media screen and (max-width: 480px) {
        .mq_sm {
            display: none !important;
        }
        .mq_xs {
            display: block !important;
        }
    }

    @font-face {
        font-family: "PlusJakartaSansRegular";
        src: url(${ PlusJakartaSansRegular }) format("truetype");
        font-weight: normal;
        font-style: normal;
    }

    @font-face {
        font-family: "PlusJakartaSansSemiBold";
        src: url(${ PlusJakartaSansSemiBold }) format("truetype");
        font-weight: bold;
        font-style: normal;
    }

    @font-face {
        font-family: "PlusJakartaSansMedium";
        src: url(${ PlusJakartaSansMedium }) format("truetype");
        font-weight: bold;
        font-style: normal;
    }

    @font-face {
        font-family: "PlusJakartaSansExtraBold";
        src: url(${ PlusJakartaSansExtraBold }) format("truetype");
        font-weight: bold;
        font-style: normal;
    }
`;
