import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import Github from '../icons/GithubIcon';

interface SubmitSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
}

export default function SubmitSkillModal({ isOpen, onClose, locale }: SubmitSkillModalProps) {
  const [mounted, setMounted] = useState(false);
  const [url, setUrl] = useState('');
  const [step, setStep] = useState<'input' | 'validating' | 'preview' | 'submitting' | 'success'>('input');
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      // Reset state when closed
      setTimeout(() => {
        setUrl('');
        setStep('input');
        setError(null);
        setPreviewData(null);
      }, 300);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const handleValidate = async (e: any) => {
    e.preventDefault();
    if (!url.trim()) return;

    setStep('validating');
    setError(null);

    try {
      const res = await fetch(`/api/skills/submit?url=${encodeURIComponent(url)}`);
      const data = (await res.json()) as any;

      if (!res.ok) {
        throw new Error(data.error || 'Validation failed');
      }

      setPreviewData(data.skill);
      setStep('preview');
    } catch (err: any) {
      setError(err.message);
      setStep('input');
    }
  };

  const handleSubmit = async () => {
    setStep('submitting');
    setError(null);

    try {
      const res = await fetch('/api/skills/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repoUrl: url }),
      });
      const data = (await res.json()) as any;

      if (!res.ok) {
        throw new Error(data.error || 'Submission failed');
      }

      setStep('success');
    } catch (err: any) {
      setError(err.message);
      setStep('preview');
    }
  };

  const isZh = locale === 'zh';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={step === 'submitting' ? undefined : onClose}
      />

      {/* Modal Content - Neo Brutalism */}
      <div className="relative w-full max-w-lg bg-[var(--background)] border-4 border-[var(--border)] shadow-[8px_8px_0px_0px_var(--border)] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-4 border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-[var(--primary)] border-2 border-[var(--border)] text-[var(--primary-foreground)] font-black shadow-[2px_2px_0px_0px_var(--border)]">
              +
            </div>
            <h2 className="text-xl font-black uppercase tracking-widest text-[var(--foreground)] mt-1">
              {isZh ? '提交新技能' : 'Submit Skill'}
            </h2>
          </div>
          <button
            onClick={step === 'submitting' ? undefined : onClose}
            disabled={step === 'submitting'}
            className="p-1 uppercase font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            <X strokeWidth={3} className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8">
          {error && (
            <div className="mb-6 px-4 py-3 bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-500 text-rose-700 dark:text-rose-400 font-bold text-sm shadow-[4px_4px_0px_0px_rgba(244,63,94,1)]">
              {error}
            </div>
          )}

          {step === 'input' || step === 'validating' ? (
            <form onSubmit={handleValidate} className="space-y-6">
              <div>
                <label className="block text-sm font-black uppercase tracking-widest text-[var(--foreground)] mb-3 font-mono">
                  {isZh ? 'GitHub 仓库地址' : 'GitHub Repository URL'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Github className="h-5 w-5 text-[var(--muted-foreground)]" />
                  </div>
                  <input
                    type="text"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={step === 'validating'}
                    placeholder="https://github.com/owner/repo"
                    className="block w-full pl-12 pr-4 py-4 text-base bg-[var(--card)] border-[3px] border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-0 focus:border-[var(--primary)] transition-colors font-mono disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-900"
                  />
                </div>
                <p className="mt-3 text-xs text-[var(--muted-foreground)] font-bold font-mono">
                  {isZh
                    ? '* 仓库根目录必须包含 SKILL.md 文件才能被系统收录'
                    : '* Repository must contain a SKILL.md file at root'}
                </p>
              </div>

              <button
                type="submit"
                disabled={!url || step === 'validating'}
                className="w-full flex items-center justify-center gap-2 py-4 bg-[var(--foreground)] text-[var(--background)] border-2 border-[var(--border)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] text-sm font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_var(--border)] transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {step === 'validating' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {isZh ? '解析中...' : 'Validating...'}
                  </>
                ) : (
                  <>
                    {isZh ? '解析验证' : 'Validate Repo'}
                    <ArrowRight strokeWidth={3} className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          ) : step === 'preview' || step === 'submitting' ? (
            <div className="space-y-6">
              <div className="p-5 border-[3px] border-dashed border-[var(--border)] bg-[var(--card)] relative">
                <div className="absolute -top-3 -left-3 bg-[var(--primary)] text-[var(--primary-foreground)] border-2 border-[var(--border)] px-2 py-1 text-xs font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_var(--border)] animate-bounce font-mono">
                  {isZh ? '解析成功!' : 'Found!'}
                </div>

                <h3 className="text-xl font-black text-[var(--foreground)] mb-2 mt-2 break-words">
                  {previewData?.frontmatter?.name || previewData?.name}
                </h3>
                <p className="text-sm font-bold text-[var(--muted-foreground)] mb-4 font-mono leading-relaxed">
                  {previewData?.frontmatter?.description || previewData?.description || 'No description provided.'}
                </p>

                <div className="flex flex-wrap gap-4 text-xs font-black uppercase tracking-widest font-mono">
                  <div className="flex items-center gap-1.5 text-[var(--foreground)] pt-3 border-t-2 border-[var(--border)] w-full">
                    <img
                      src={`https://github.com/${previewData?.owner}.png`}
                      alt={previewData?.owner}
                      className="w-5 h-5 border border-[var(--border)]"
                    />
                    <span>{previewData?.owner}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  disabled={step === 'submitting'}
                  className="flex-1 py-4 bg-[var(--card)] text-[var(--foreground)] border-[3px] border-[var(--border)] hover:bg-[var(--foreground)] hover:text-[var(--background)] text-sm font-black uppercase tracking-widest transition-colors disabled:opacity-50"
                >
                  {isZh ? '上一步' : 'Back'}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={step === 'submitting'}
                  className="flex-[2] flex items-center justify-center gap-2 py-4 bg-[var(--primary)] text-[var(--primary-foreground)] border-[3px] border-[var(--border)] hover:bg-emerald-500 hover:text-white text-sm font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_var(--border)] transition-all disabled:opacity-50"
                >
                  {step === 'submitting' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {isZh ? '提交中...' : 'Submitting...'}
                    </>
                  ) : (
                    <>
                      {isZh ? '确认提交' : 'Submit Skill'}
                      <ArrowRight strokeWidth={3} className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 border-4 border-emerald-500 rounded-full shadow-[8px_8px_0px_0px_rgba(16,185,129,1)]">
                <CheckCircle2 strokeWidth={3} className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-[var(--foreground)] mb-2 uppercase tracking-tight">
                  {isZh ? '提交已接收!' : 'Submission Received!'}
                </h3>
                <p className="text-[var(--muted-foreground)] font-bold text-sm font-mono leading-relaxed">
                  {isZh
                    ? '您的技能已进入审批队列。我们将在审核其质量与安全性后，正式将其收录进排行榜。'
                    : 'Your skill is now in the review queue. We will perform quality and safety checks before officially listing it.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full mt-4 py-4 bg-[var(--foreground)] text-[var(--background)] border-2 border-[var(--border)] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_var(--border)] transition-all"
              >
                {isZh ? '关闭' : 'Close'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
