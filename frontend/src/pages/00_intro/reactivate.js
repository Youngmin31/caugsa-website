/**
 * 기존 회원 계정 활성화 (한시적)
 * ==============================
 * 리뉴얼 이관 때 비밀번호를 옮기지 않아 기존 회원 전원이 로그인할 수 없다.
 * 아이디만 입력하면 서버가 그 계정에 등록된 이메일을 찾아 인증 코드를 보내고,
 * 인증 후 새 비밀번호와 이관 때 채우지 못한 정보(학번·단과대·학과·연락처)를
 * 한 번에 받는다.
 *
 * 화면은 세 단계다.
 *   request  아이디 입력 -> 코드 발송
 *   verify   코드 확인
 *   form     새 비밀번호 + 누락 정보
 *
 * 한시적 기능이라 끝나면 이 파일과 router.js 의 라우트 한 줄, 로그인 화면의
 * 링크만 지우면 된다. 백엔드는 REACTIVATION_ENABLED=false 로 끌 수 있다.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useApi from "../../hooks/api/axiosInterceptor";

import PageHeader from "../../components/board/PageHeader";
import PasswordField from "../../components/form/PasswordField";
import { COLLEGES, majorsOf } from "../../config/colleges";
import {
    ButtonRow,
    Card,
    ErrorMessage,
    Form,
    FormGroup,
    HelpLink,
    HelpLinks,
    Input,
    Intro,
    Label,
    ResultBox,
    SecondaryLink,
    SubmitButton,
} from "../../components/form/AuthForm";
import { isValidPassword, PASSWORD_RULE_MESSAGE } from "../../utils/password";

// 서버 응답에서 메시지를 꺼낸다. 실패 응답은 status/result 두 형태가 섞여 있다.
const messageOf = (error, fallback) =>
    error?.response?.data?.message || fallback;

const Reactivate = () => {
    const navigate = useNavigate();

    const [step, setStep] = useState("request");
    const [userId, setUserId] = useState("");
    const [code, setCode] = useState("");
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);

    // 2.5단계 — 포탈 아이디 추가 인증. status: idle -> sent -> verified
    const [portalId, setPortalId] = useState("");
    const [portalCode, setPortalCode] = useState("");
    const [portalStatus, setPortalStatus] = useState("idle");
    const [portalMasked, setPortalMasked] = useState("");
    const [portalBusy, setPortalBusy] = useState(false);
    const [portalResendAt, setPortalResendAt] = useState(null);
    // 겹침/만료/시도초과 등 더 이상 이 경로로 못 뚫는 상황 -> 회원가입 안내.
    const [portalBlocked, setPortalBlocked] = useState(false);

    // 재전송 쿨다운 표시용 1초 틱.
    const [tick, setTick] = useState(0);
    useEffect(() => {
        if (!portalResendAt) return undefined;
        const timer = setInterval(() => setTick((prev) => prev + 1), 1000);
        return () => clearInterval(timer);
    }, [portalResendAt]);
    const PORTAL_RESEND_SECONDS = 60;
    const portalCooldown = portalResendAt
        ? Math.max(
              0,
              PORTAL_RESEND_SECONDS - Math.floor((Date.now() - portalResendAt) / 1000)
          )
        : 0;
    // eslint-disable-next-line no-unused-expressions
    tick; // 위 쿨다운 계산이 매초 다시 평가되도록 리렌더만 유도한다.

    const [form, setForm] = useState({
        password: "",
        confirmPassword: "",
        studentId: "",
        college: "",
        major: "",
        phone1: "",
        phone2: "",
        phone3: "",
    });

    const majorOptions = useMemo(() => majorsOf(form.college), [form.college]);

    const setField = (name, value) => {
        setForm((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    };

    // -----------------------------------------------------------------------
    // 1단계 — 코드 요청
    // -----------------------------------------------------------------------
    const requestCode = async (e) => {
        e.preventDefault();
        if (!userId.trim()) {
            setErrors({ userId: "아이디를 입력해주세요" });
            return;
        }

        setBusy(true);
        try {
            await useApi.post("/reactivate/request", {
                userId: userId.trim(),
            });
            // 계정이 없거나 이미 활성화된 경우에도 같은 응답이 온다(열거 방지).
            // 그래서 안내 문구도 결과와 무관하게 항상 같은 고정 문구를 보여준다.
            setStep("verify");
        } catch (error) {
            setErrors({
                userId: messageOf(error, "요청 중 오류가 발생했습니다."),
            });
        } finally {
            setBusy(false);
        }
    };

    // -----------------------------------------------------------------------
    // 2단계 — 코드 확인
    // -----------------------------------------------------------------------
    const verifyCode = async (e) => {
        e.preventDefault();
        if (!code.trim()) {
            setErrors({ code: "인증 코드를 입력해주세요" });
            return;
        }

        setBusy(true);
        try {
            const { data } = await useApi.post("/reactivate/verify", {
                userId: userId.trim(),
                code: code.trim(),
            });
            // 인증을 통과해야 기존 연락처를 받는다. 미리 채워 보여준다.
            const mobile = data?.prefill?.mobile || "";
            const parts = mobile.split("-");
            setForm((prev) => ({
                ...prev,
                phone1: parts[0] || "",
                phone2: parts[1] || "",
                phone3: parts[2] || "",
            }));
            setErrors({});
            setStep("form");
        } catch (error) {
            setErrors({ code: messageOf(error, "인증에 실패했습니다.") });
        } finally {
            setBusy(false);
        }
    };

    // -----------------------------------------------------------------------
    // 2.5단계 — 포탈 아이디 추가 인증
    //
    // 이관 때 저장된 이메일은 검증된 적이 없어, 학교 구성원인지 확인하려면
    // 지금 직접 입력한 포탈 아이디로 @cau.ac.kr 메일함 접근을 한 번 더
    // 증명받아야 한다. 통과해야만 아래 "활성화 완료" 버튼이 열린다.
    // -----------------------------------------------------------------------
    const requestPortalCode = async () => {
        if (!portalId.trim()) {
            setErrors((prev) => ({ ...prev, portalId: "포탈 아이디를 입력해주세요" }));
            return;
        }
        setPortalBusy(true);
        setPortalBlocked(false);
        try {
            const { data } = await useApi.post("/reactivate/portal-request", {
                userId: userId.trim(),
                portalId: portalId.trim(),
            });
            setPortalMasked(data?.maskedEmail || "");
            setPortalStatus("sent");
            setPortalResendAt(Date.now());
            setPortalCode("");
            setErrors((prev) => ({ ...prev, portalId: "", portalCode: "" }));
        } catch (error) {
            const errorCode = error?.response?.data?.error_code;
            if (errorCode === "email_exists") setPortalBlocked(true);
            setErrors((prev) => ({
                ...prev,
                portalId: messageOf(error, "요청 중 오류가 발생했습니다."),
            }));
        } finally {
            setPortalBusy(false);
        }
    };

    const verifyPortalCode = async () => {
        if (!portalCode.trim()) {
            setErrors((prev) => ({ ...prev, portalCode: "인증 코드를 입력해주세요" }));
            return;
        }
        setPortalBusy(true);
        try {
            await useApi.post("/reactivate/portal-verify", {
                userId: userId.trim(),
                code: portalCode.trim(),
            });
            setPortalStatus("verified");
            setErrors((prev) => ({ ...prev, portalCode: "" }));
        } catch (error) {
            const errorCode = error?.response?.data?.error_code;
            if (errorCode === "portal_too_many_attempts" || errorCode === "portal_code_expired") {
                setPortalBlocked(true);
            }
            setErrors((prev) => ({
                ...prev,
                portalCode: messageOf(error, "인증에 실패했습니다."),
            }));
        } finally {
            setPortalBusy(false);
        }
    };

    // -----------------------------------------------------------------------
    // 3단계 — 완료
    // -----------------------------------------------------------------------
    const validate = () => {
        const next = {};
        // 검증 규칙은 회원가입(signup.js)과 같게 맞춘다.
        if (!form.password) {
            next.password = "비밀번호를 입력해주세요";
        } else if (!isValidPassword(form.password)) {
            next.password = PASSWORD_RULE_MESSAGE;
        }
        if (form.password !== form.confirmPassword) {
            next.confirmPassword = "비밀번호가 일치하지 않습니다";
        }
        if (!form.studentId.trim()) {
            next.studentId = "학번을 입력해주세요";
        } else if (!/^\d{4,12}$/.test(form.studentId)) {
            next.studentId = "학번은 숫자 4~12자리여야 합니다";
        }
        if (!form.college) next.college = "단과대를 선택해주세요";
        if (!form.major) next.major = "학과를 선택해주세요";
        if (!form.phone1 || !form.phone2 || !form.phone3) {
            next.phone = "연락처를 모두 입력해주세요";
        } else if (
            !/^\d{2,3}$/.test(form.phone1) ||
            !/^\d{3,4}$/.test(form.phone2) ||
            !/^\d{4}$/.test(form.phone3)
        ) {
            next.phone = "유효한 연락처를 입력해주세요";
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const complete = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setBusy(true);
        try {
            const { data } = await useApi.post("/reactivate/complete", {
                userId: userId.trim(),
                password: form.password,
                studentId: form.studentId.trim(),
                college: form.college,
                major: form.major,
                phone: `${form.phone1}-${form.phone2}-${form.phone3}`,
            });
            // 학번이 다른 계정과 겹쳐도 막지 않는다. 안내만 한다.
            if (data?.warning) alert(data.warning);
            alert("계정이 활성화되었습니다. 새 비밀번호로 로그인해주세요.");
            navigate("/intro/login");
        } catch (error) {
            const fields = error?.response?.data?.errors;
            if (fields) {
                setErrors(fields);
            } else {
                setErrors({ form: messageOf(error, "처리 중 오류가 발생했습니다.") });
            }
        } finally {
            setBusy(false);
        }
    };

    // -----------------------------------------------------------------------
    return (
        <>
            <PageHeader title="계정 활성화" />
            <Card>
                {step === "request" && (
                    <Form onSubmit={requestCode}>
                        <Intro>
                            아이디를 입력하면 가입 시 등록한 이메일로 인증 코드를 보내드립니다.
                        </Intro>

                        <Intro>
                            <strong>아이디가 기억나지 않으시나요?</strong>
                            <br />
                            새로 회원가입을 진행해주세요. 계정 활성화를 완료하지 않은
                            기존 계정은 2026년 11월 30일 이후 삭제될 예정입니다.
                        </Intro>

                        <FormGroup>
                            <Label htmlFor="userId">아이디</Label>
                            <Input
                                id="userId"
                                value={userId}
                                onChange={(e) => {
                                    setUserId(e.target.value);
                                    if (errors.userId) setErrors({});
                                }}
                                placeholder="아이디를 입력하세요"
                                autoComplete="username"
                            />
                            {errors.userId && <ErrorMessage>{errors.userId}</ErrorMessage>}
                        </FormGroup>

                        <ButtonRow>
                            <SecondaryLink to="/intro/login">로그인으로</SecondaryLink>
                            <SubmitButton type="submit" disabled={busy}>
                                {busy ? "전송 중..." : "인증 코드 받기"}
                            </SubmitButton>
                        </ButtonRow>

                        <HelpLinks>
                            <HelpLink to="/intro/signup">회원가입</HelpLink>
                        </HelpLinks>
                    </Form>
                )}

                {step === "verify" && (
                    <Form onSubmit={verifyCode}>
                        <ResultBox $ok>
                            <p>가입 시 등록된 이메일로 인증 코드가 전송되었습니다.</p>
                            <p>
                                인증 코드는 발송 후 <strong>10분간</strong> 유효합니다.
                            </p>
                            <p>
                                {"인증에 어려움이 있다면 기존 회원이더라도 새로 가입하셔도 괜찮습니다.\n"
                                    + "기존 계정은 2026년 11월 30일 이후 삭제될 예정입니다."}
                            </p>
                        </ResultBox>
                        <SecondaryLink to="/intro/signup">회원가입 하기</SecondaryLink>

                        <FormGroup>
                            <Label htmlFor="code">인증 코드</Label>
                            <Input
                                id="code"
                                value={code}
                                onChange={(e) => {
                                    setCode(e.target.value);
                                    if (errors.code) setErrors({});
                                }}
                                placeholder="6자리 숫자"
                                inputMode="numeric"
                                maxLength={6}
                            />
                            {errors.code && <ErrorMessage>{errors.code}</ErrorMessage>}
                        </FormGroup>

                        <ButtonRow>
                            <SecondaryLink to="/intro/reactivate" onClick={() => setStep("request")}>
                                이전
                            </SecondaryLink>
                            <SubmitButton type="submit" disabled={busy}>
                                {busy ? "확인 중..." : "확인"}
                            </SubmitButton>
                        </ButtonRow>
                    </Form>
                )}

                {step === "form" && (
                    <Form onSubmit={complete}>
                        <Intro>
                            새 비밀번호와 회원 정보를 입력해주세요.
                        </Intro>

                        <FormGroup>
                            <Label htmlFor="portalId">포탈 아이디</Label>
                            <Intro>
                                학교 구성원 전용 게시판 이용을 위해 인증을 완료해주세요.
                            </Intro>
                            <div style={{ display: "flex", gap: 8 }}>
                                <Input
                                    id="portalId"
                                    value={portalId}
                                    onChange={(e) => {
                                        setPortalId(e.target.value);
                                        if (errors.portalId) {
                                            setErrors((prev) => ({ ...prev, portalId: "" }));
                                        }
                                    }}
                                    placeholder="포탈 아이디 (예: puang)"
                                    disabled={portalStatus === "verified"}
                                    autoComplete="off"
                                />
                                <SubmitButton
                                    type="button"
                                    onClick={requestPortalCode}
                                    disabled={
                                        portalBusy ||
                                        portalStatus === "verified" ||
                                        portalCooldown > 0
                                    }
                                >
                                    {portalStatus === "sent"
                                        ? portalCooldown > 0
                                            ? `재전송(${portalCooldown}초)`
                                            : "재전송"
                                        : portalBusy
                                        ? "전송 중..."
                                        : "인증코드 받기"}
                                </SubmitButton>
                            </div>
                            {errors.portalId && <ErrorMessage>{errors.portalId}</ErrorMessage>}

                            {portalStatus !== "verified" && portalStatus === "sent" && (
                                <>
                                    <Intro>
                                        {portalMasked && `${portalMasked} 로 `}
                                        확인 코드를 보냈습니다. 이 코드는 전송 시각
                                        기준으로 <strong>10분간</strong> 유효합니다.
                                    </Intro>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <Input
                                            value={portalCode}
                                            onChange={(e) => {
                                                setPortalCode(e.target.value);
                                                if (errors.portalCode) {
                                                    setErrors((prev) => ({ ...prev, portalCode: "" }));
                                                }
                                            }}
                                            placeholder="6자리 숫자"
                                            inputMode="numeric"
                                            maxLength={6}
                                        />
                                        <SubmitButton
                                            type="button"
                                            onClick={verifyPortalCode}
                                            disabled={portalBusy}
                                        >
                                            {portalBusy ? "확인 중..." : "확인"}
                                        </SubmitButton>
                                    </div>
                                    {errors.portalCode && (
                                        <ErrorMessage>{errors.portalCode}</ErrorMessage>
                                    )}
                                </>
                            )}

                            {portalStatus === "verified" && (
                                <ResultBox $ok>포탈 인증 완료 ({portalMasked})</ResultBox>
                            )}

                            {portalBlocked && (
                                <>
                                    <ResultBox>
                                        <p>
                                            {"인증에 어려움이 있다면 기존 회원이더라도 새로 가입하셔도 괜찮습니다.\n"
                                                + "기존 계정은 2026년 11월 30일 이후 삭제될 예정입니다."}
                                        </p>
                                    </ResultBox>
                                    <SecondaryLink to="/intro/signup">
                                        회원가입 하기
                                    </SecondaryLink>
                                </>
                            )}
                        </FormGroup>

                        <FormGroup>
                            <Label htmlFor="password">새 비밀번호</Label>
                            <PasswordField
                                id="password"
                                name="password"
                                value={form.password}
                                onChange={(e) => setField("password", e.target.value)}
                                placeholder="영문, 숫자, 특수문자 포함 8~20자"
                                autoComplete="new-password"
                            />
                            {errors.password && <ErrorMessage>{errors.password}</ErrorMessage>}
                        </FormGroup>

                        <FormGroup>
                            <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                            <PasswordField
                                id="confirmPassword"
                                name="confirmPassword"
                                value={form.confirmPassword}
                                onChange={(e) => setField("confirmPassword", e.target.value)}
                                placeholder="비밀번호를 다시 입력하세요"
                                autoComplete="new-password"
                            />
                            {errors.confirmPassword && (
                                <ErrorMessage>{errors.confirmPassword}</ErrorMessage>
                            )}
                        </FormGroup>

                        <FormGroup>
                            <Label htmlFor="studentId">학번</Label>
                            <Input
                                id="studentId"
                                value={form.studentId}
                                onChange={(e) => setField("studentId", e.target.value)}
                                placeholder="학번을 입력하세요"
                                inputMode="numeric"
                            />
                            {errors.studentId && <ErrorMessage>{errors.studentId}</ErrorMessage>}
                        </FormGroup>

                        <FormGroup>
                            <Label htmlFor="college">단과대</Label>
                            <Input
                                as="select"
                                id="college"
                                value={form.college}
                                onChange={(e) => {
                                    // 단과대를 바꾸면 학과 선택을 비운다.
                                    setForm((prev) => ({
                                        ...prev,
                                        college: e.target.value,
                                        major: "",
                                    }));
                                    if (errors.college) setErrors((prev) => ({ ...prev, college: "" }));
                                }}
                            >
                                <option value="">선택하세요</option>
                                {COLLEGES.map((college) => (
                                    <option key={college.name} value={college.name}>
                                        {college.name}
                                    </option>
                                ))}
                            </Input>
                            {errors.college && <ErrorMessage>{errors.college}</ErrorMessage>}
                        </FormGroup>

                        <FormGroup>
                            <Label htmlFor="major">학과</Label>
                            <Input
                                as="select"
                                id="major"
                                value={form.major}
                                onChange={(e) => setField("major", e.target.value)}
                                disabled={!form.college}
                            >
                                <option value="">
                                    {form.college ? "선택하세요" : "단과대를 먼저 선택하세요"}
                                </option>
                                {majorOptions.map((major) => (
                                    <option key={major} value={major}>
                                        {major}
                                    </option>
                                ))}
                            </Input>
                            {errors.major && <ErrorMessage>{errors.major}</ErrorMessage>}
                            {form.college && (
                                <Intro>
                                    학과가 개편되어 목록에 없다면 "기타/폐과 학과"를
                                    선택해주세요.
                                </Intro>
                            )}
                        </FormGroup>

                        <FormGroup>
                            <Label>연락처</Label>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Input
                                    value={form.phone1}
                                    onChange={(e) => setField("phone1", e.target.value)}
                                    inputMode="numeric"
                                    maxLength={3}
                                />
                                <span>-</span>
                                <Input
                                    value={form.phone2}
                                    onChange={(e) => setField("phone2", e.target.value)}
                                    inputMode="numeric"
                                    maxLength={4}
                                />
                                <span>-</span>
                                <Input
                                    value={form.phone3}
                                    onChange={(e) => setField("phone3", e.target.value)}
                                    inputMode="numeric"
                                    maxLength={4}
                                />
                            </div>
                            {errors.phone && <ErrorMessage>{errors.phone}</ErrorMessage>}
                        </FormGroup>

                        {errors.form && <ErrorMessage>{errors.form}</ErrorMessage>}

                        <ButtonRow $single>
                            <SubmitButton
                                type="submit"
                                disabled={busy || portalStatus !== "verified"}
                                title={
                                    portalStatus !== "verified"
                                        ? "포탈 아이디 인증을 먼저 완료해 주세요"
                                        : undefined
                                }
                            >
                                {busy ? "처리 중..." : "활성화 완료"}
                            </SubmitButton>
                        </ButtonRow>
                    </Form>
                )}
            </Card>
        </>
    );
};

export default Reactivate;
