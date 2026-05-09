type LoadingBlockProps = {
    text?: string;
};

export function LoadingBlock({ text = "Загрузка..." }: LoadingBlockProps) {
    return <div className="loading-block">{text}</div>;
}
