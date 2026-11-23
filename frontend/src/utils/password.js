/**
 * utils/password.js
 * ==================
 * 비밀번호 규칙. 영문/숫자/특수문자를 모두 포함한 8~20자.
 *
 * 이용약관(00_footer/policy.js)이 이미 "영문자와 숫자, 특수문자의 조합"으로
 * 비밀번호를 정의하고 있어 실제 검증도 그 문구에 맞춘다. 회원가입과 계정
 * 활성화(재설정)가 같은 규칙을 쓰도록 여기 한 곳에만 둔다 — 서버 쪽
 * (api_v2/helpers.py의 PASSWORD_RE)과 반드시 같은 규칙이어야 한다.
 */

export const PASSWORD_ALLOWED_SPECIAL = "!@#$%^&*()_+-=";

const ESCAPED_SPECIAL = PASSWORD_ALLOWED_SPECIAL.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");

export const PASSWORD_RE = new RegExp(
    `^(?=.*[A-Za-z])(?=.*\\d)(?=.*[${ESCAPED_SPECIAL}])[A-Za-z\\d${ESCAPED_SPECIAL}]{8,20}$`
);

export const PASSWORD_RULE_MESSAGE =
    `비밀번호는 영문, 숫자, 특수문자(${PASSWORD_ALLOWED_SPECIAL})를 모두 포함해 8~20자로 입력해 주세요.`;

export const isValidPassword = (password) => Boolean(password) && PASSWORD_RE.test(password);
