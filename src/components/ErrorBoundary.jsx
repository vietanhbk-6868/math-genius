import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page">
          <p className="error">
            Có lỗi khi hiển thị trang: {String(this.state.error.message || this.state.error)}
          </p>
          <button onClick={() => window.location.reload()}>Tải lại</button>
        </div>
      );
    }
    return this.props.children;
  }
}