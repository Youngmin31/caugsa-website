/**
 * 비밀번호 찾기 (포탈 메일)
 * =========================
 * 아이디 + 이름 + 포탈 아이디가 맞으면 포탈 메일로 임시 비밀번호를 보낸다.
 * 화면은 로그인/회원가입과 같은 카드 폼(components/form/AuthForm).
 */

import React, { useState } from "react";
import useApi from "../../hooks/api/axiosInterceptor";

import PageHeader from "../../components/board/PageHeader";
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

const FIELDS = [
    { name: "userId", label: "아이디", placeholder: "아이디를 입력하세요", message: "아이디를 입력해주세요" },
    { name: "name", label: "이름", placeholder: "이름을 입력하세요", message: "이름을 입력해주세요" },
    {
        name: "portalId",
        label: "포탈 아이디",
        placeholder: "포탈 아이디를 입력하세요",
        message: "가입 때 등록한 포탈 아이디를 입력해주세요",
    },
];

const PwSearch = () => {
    const [form, setForm] = useState({ userId: "", name: "", portalId: "" });
    const [errors, setErrors] = useState({});
    const [result, setResult] = useState(null);
    const [isSearching, setIsSearching] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const newErrors = {};
        FIELDS.forEach((field) => {
            if (!form[field.name].trim()) newErrors[field.name] = field.message;
        });
        setErrors(newErrors);
        if (Object.keys(newErrors).length) return;

        setIsSearching(true);
        try {
            const response = await useApi.post("/auth/pw_search", {
                userId: form.userId,
                name: form.name,
                portalId: form.portalId,
            });

            if (response.data.status === "SUCCESS") {
                setResult({ ok: true, name: response.data.data.name, email: response.data.data.email });
            } else {
                setResult({
                    ok: false,
                    message: response.data.message || "입력하신 정보와 맞는 계정이 없습니다.",
                });
            }
        } catch (error) {
            console.error("비밀번호 찾기 오류:", error);
            // 아직 활성화 안 한(이관된) 계정이면 서버가 400 + needs_reactivation 을
            // 주는데, axios 는 4xx 를 전부 reject 로 던지므로 여기서 받는다.
            const errorCode = error.response?.data?.error_code;
            setResult({
                ok: false,
                needsReactivation: errorCode === "needs_reactivation",
                message:
                    error.response?.data?.message ||
                    "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
            });
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <>
            <PageHeader
                title="비밀번호 찾기"
                crumbs={[{ label: "Home", to: "/home" }, { label: "비밀번호 찾기" }]}
            />
            <Card>
                {result ? (
                    <Form as="div">
                        <ResultBox $ok={result.ok}>
                            {result.ok ? (
                                <>
                                    <p>
                                        <strong>{result.name}</strong> 회원님 반갑습니다.
                                    </p>
                                    <p>
                                        포탈 메일(<strong>{result.email}</strong>)로 임시 비밀번호를
                                        보냈습니다.
                                    </p>
                                    <p>로그인 후 비밀번호를 바꿔 주세요.</p>
                                </>
                            ) : (
                                <p>{result.message}</p>
                            )}
                        </ResultBox>

                        <ButtonRow>
                            {result.needsReactivation ? (
                                <SecondaryLink to="/intro/reactivate">계정 활성화</SecondaryLink>
                            ) : (
                                <SecondaryLink as="button" type="button" onClick={() => setResult(null)}>
                                    다시 찾기
                                </SecondaryLink>
                            )}
                            <SecondaryLink to="/intro/login">로그인</SecondaryLink>
                        </ButtonRow>
                    </Form>
                ) : (
                    <Form onSubmit={handleSubmit}>
                        <Intro>
                            아이디와 가입 정보가 일치하면 포탈 이메일로 임시 비밀번호를 보내 드립니다.
                        </Intro>

                        {FIELDS.map((field) => (
                            <FormGroup key={field.name}>
                                <Label htmlFor={field.name}>{field.label}</Label>
                                <Input
                                    type="text"
                                    id={field.name}
                                    name={field.name}
                                    value={form[field.name]}
                                    onChange={handleChange}
                                    placeholder={field.placeholder}
                                    autoComplete="off"
                                />
                                {errors[field.name] && (
                                    <ErrorMessage>{errors[field.name]}</ErrorMessage>
                                )}
                            </FormGroup>
                        ))}

                        <ButtonRow $single>
                            <SubmitButton type="submit" disabled={isSearching}>
                                {isSearching ? "보내는 중…" : "임시 비밀번호 받기"}
                            </SubmitButton>
                        </ButtonRow>
                    </Form>
                )}

                <HelpLinks>
                    <HelpLink to="/intro/login">로그인</HelpLink>
                    <HelpLink to="/intro/login/id-search">아이디 찾기</HelpLink>
                    <HelpLink to="/intro/signup">회원가입</HelpLink>
                </HelpLinks>
            </Card>
        </>
    );
};

export default PwSearch;
